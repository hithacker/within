import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import type { AppConfig } from './config.js';
import type { ConversationModel, JournalModel } from './gemini.js';
import { applyDirectAnswerPreference } from './direct-answer.js';
import { classifySafety, safetyReply } from './safety.js';
import { conversationRequestSchema, journalAnalysisRequestSchema } from './schema.js';
import type { AccountService } from './account.js';
import type { KnowledgePackService } from './knowledge-pack.js';
import { knowledgePackContentSchema } from './knowledge-pack-schema.js';

type Dependencies = {
  config: AppConfig;
  model?: JournalModel;
  conversationModel?: ConversationModel;
  accountService?: AccountService;
  knowledgePackService?: KnowledgePackService;
};

const packIdPattern = /^[a-z][a-z0-9_.-]{2,79}$/;
const versionPattern = /^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/;

export function createApp({ config, model, conversationModel, accountService, knowledgePackService }: Dependencies) {
  const app = express();
  const allowedOrigins = new Set(config.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean));

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error('Origin is not allowed'));
    },
  }));
  app.use(express.json({ limit: '128kb' }));

  const legalPage = (title: string, body: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} | Within</title></head><body><main><h1>${title}</h1>${body}</main></body></html>`;

  app.get('/privacy', (_request, response) => {
    response.type('html').send(legalPage('Privacy Policy', `
      <p><strong>Effective date:</strong> July 17, 2026</p>
      <p>Within is an AI-assisted conversation for personal reflection. It is not therapy, medical advice, diagnosis, prediction, or an emergency service.</p>
      <h2>Information processed</h2>
      <p>Your recent messages, rolling conversation summary, and relevant remembered context are sent to our API and Google Gemini to generate a response. If you enable account sync, your conversation and remembered context are also stored in our Supabase-hosted database so they are available on your devices.</p>
      <h2>How information is used</h2>
      <p>Submitted text is used only to provide the requested response, operate safety controls, prevent abuse, and maintain the service. We do not sell conversation information or use it for advertising.</p>
      <h2>Service providers</h2>
      <p>We use Google Gemini for structured AI analysis, Fly.io to host the API, and Supabase for optional authentication and journal sync. These providers process technical and submitted data to deliver their services.</p>
      <h2>Your choices</h2>
      <p>You can use Within without an account. You can clear your conversation, delete synced data, and delete your account from the app.</p>
      <h2>Contact</h2>
      <p>${config.SUPPORT_EMAIL ? `For privacy questions, email <a href="mailto:${config.SUPPORT_EMAIL}">${config.SUPPORT_EMAIL}</a>.` : 'For privacy questions, use the support contact published with the app’s App Store listing.'}</p>
    `));
  });

  app.get('/support', (_request, response) => {
    response.type('html').send(legalPage('Within Support', `
      <p>Within helps adults think through relationships, decisions, and recurring patterns. It is not an emergency or medical service.</p>
      <h2>Get help with the app</h2>
      <p>${config.SUPPORT_EMAIL ? `Email <a href="mailto:${config.SUPPORT_EMAIL}">${config.SUPPORT_EMAIL}</a> with your device model, iOS version, and a description of the issue. Do not include private journal text.` : 'Support contact details will be published here before the App Store release.'}</p>
      <h2>Immediate danger</h2>
      <p>If you or someone else may be in immediate danger, contact local emergency services. In India, call 112.</p>
      <p><a href="/privacy">Privacy Policy</a></p>
    `));
  });

  app.get('/health', (_request, response) => {
    response.json({
      status: 'ok',
      model: config.GEMINI_MODEL,
      fallbackModel: config.GEMINI_FALLBACK_MODEL,
      configured: Boolean(conversationModel ?? model),
      mode: 'conscientious-conversation',
    });
  });

  app.post('/v1/conversations/respond', rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }), async (request, response, next) => {
    const parsed = conversationRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        error: 'invalid_request',
        issues: parsed.error.issues.map(({ path, message }) => ({ path: path.join('.'), message })),
      });
      return;
    }

    const latestMessage = parsed.data.messages.at(-1)!;
    const safety = classifySafety(latestMessage.content);
    if (safety.action !== 'continue') {
      response.json({ response: null, safetyAction: safety.action, supportMessage: safetyReply(safety) });
      return;
    }

    if (!conversationModel) {
      response.status(503).json({ error: 'model_not_configured', message: 'GEMINI_API_KEY is not configured' });
      return;
    }

    try {
      const result = applyDirectAnswerPreference(await conversationModel.respond(parsed.data), parsed.data);
      response.json({ response: result, safetyAction: 'continue' });
    } catch (error) {
      next(error);
    }
  });

  app.post(['/v1/collections/validate', '/v1/knowledge-packs/validate'], rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }), (request, response) => {
    const parsed = knowledgePackContentSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(422).json({
        valid: false,
        issues: parsed.error.issues.map(({ path, message }) => ({ path: path.join('.'), message })),
      });
      return;
    }
    response.json({ valid: true });
  });

  app.get(['/v1/collections/:packId', '/v1/knowledge-packs/:packId'], rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }), async (request, response, next) => {
    if (!knowledgePackService) {
      response.status(503).json({ error: 'collection_service_not_configured' });
      return;
    }

    const packId = typeof request.params.packId === 'string' ? request.params.packId : undefined;
    const version = typeof request.query.version === 'string' ? request.query.version : undefined;
    if (!packId || !packIdPattern.test(packId) || (version && !versionPattern.test(version))) {
      response.status(400).json({ error: 'invalid_collection_reference' });
      return;
    }

    try {
      const pack = await knowledgePackService.getPublishedPack(packId, version);
      if (!pack) {
        response.status(404).json({ error: 'collection_not_found' });
        return;
      }
      response.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600').json({ pack });
    } catch (error) {
      next(error);
    }
  });

  app.post('/v1/journal/analyze', rateLimit({
    windowMs: 60_000,
    limit: 12,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }), async (request, response, next) => {
    const parsed = journalAnalysisRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        error: 'invalid_request',
        issues: parsed.error.issues.map(({ path, message }) => ({ path: path.join('.'), message })),
      });
      return;
    }

    const currentEntry = parsed.data.entries.find((entry) => entry.id === parsed.data.currentEntryId)!;
    const safety = classifySafety(currentEntry.body);
    if (safety.action !== 'continue') {
      response.json({ analysis: null, safetyAction: safety.action, supportMessage: safetyReply(safety) });
      return;
    }

    if (!model) {
      response.status(503).json({ error: 'model_not_configured', message: 'GEMINI_API_KEY is not configured' });
      return;
    }
    if (!knowledgePackService) {
      response.status(503).json({ error: 'collection_service_not_configured' });
      return;
    }

    try {
      const collection = await knowledgePackService.getPublishedPack(
        parsed.data.collectionId,
        parsed.data.collectionVersion,
      );
      if (!collection) {
        response.status(404).json({ error: 'collection_not_found' });
        return;
      }
      const analysis = await model.analyze(parsed.data, collection);
      response.json({ analysis, safetyAction: 'continue' });
    } catch (error) {
      next(error);
    }
  });

  app.delete('/v1/account', rateLimit({
    windowMs: 60_000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }), async (request, response, next) => {
    if (!accountService) {
      response.status(503).json({ error: 'account_service_not_configured' });
      return;
    }

    const accessToken = request.header('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!accessToken) {
      response.status(401).json({ error: 'authentication_required' });
      return;
    }

    try {
      await accountService.deleteAccount(accessToken);
      response.status(204).send();
    } catch (error) {
      if (error instanceof Error && error.message === 'invalid_access_token') {
        response.status(401).json({ error: 'invalid_access_token' });
        return;
      }
      next(error);
    }
  });

  const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
    const requestId = request.headers['x-request-id'] ?? crypto.randomUUID();
    console.error(JSON.stringify({ level: 'error', requestId, path: request.path, message: error instanceof Error ? error.message : 'Unknown error' }));
    if (request.path === '/v1/account') {
      response.status(502).json({ error: 'account_service_unavailable', message: 'Account deletion is temporarily unavailable', requestId });
      return;
    }
    if (request.path.startsWith('/v1/knowledge-packs/') || request.path.startsWith('/v1/collections/')) {
      response.status(502).json({ error: 'collection_unavailable', message: 'Published content is temporarily unavailable', requestId });
      return;
    }
    response.status(502).json({ error: 'model_unavailable', message: 'AI response is temporarily unavailable', requestId });
  };
  app.use(errorHandler);

  return app;
}
