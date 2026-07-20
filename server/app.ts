import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import type { AppConfig } from './config.js';
import type { JournalModel } from './gemini.js';
import { classifySafety, safetyReply } from './safety.js';
import { journalAnalysisRequestSchema } from './schema.js';

type Dependencies = {
  config: AppConfig;
  model?: JournalModel;
};

export function createApp({ config, model }: Dependencies) {
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
  app.use(express.json({ limit: '64kb' }));

  const legalPage = (title: string, body: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} | Within</title></head><body><main><h1>${title}</h1>${body}</main></body></html>`;

  app.get('/privacy', (_request, response) => {
    response.type('html').send(legalPage('Privacy Policy', `
      <p><strong>Effective date:</strong> July 17, 2026</p>
      <p>Within is an AI-assisted private journal and life-skills product. It is not therapy, medical advice, diagnosis, prediction, or an emergency service.</p>
      <h2>Information processed</h2>
      <p>When you choose AI analysis, the journal entry and a limited recent journal history are sent to our API and Google Gemini to extract themes and possible recurring patterns. The current prototype keeps entries and returned insights on your device and does not persist journal text in a Within database.</p>
      <h2>How information is used</h2>
      <p>Submitted text is used only to provide the requested analysis, operate safety controls, prevent abuse, and maintain the service. We do not sell journal information or use it for advertising.</p>
      <h2>Service providers</h2>
      <p>We use Google Gemini for structured AI analysis and Fly.io to host the API. These providers process technical and submitted data to deliver their services.</p>
      <h2>Your choices</h2>
      <p>You can save an entry without AI analysis. You can delete entries and locally stored insights from the app.</p>
      <h2>Contact</h2>
      <p>${config.SUPPORT_EMAIL ? `For privacy questions, email <a href="mailto:${config.SUPPORT_EMAIL}">${config.SUPPORT_EMAIL}</a>.` : 'For privacy questions, use the support contact published with the app’s App Store listing.'}</p>
    `));
  });

  app.get('/support', (_request, response) => {
    response.type('html').send(legalPage('Within Support', `
      <p>Within helps adults journal, notice patterns, and practice life skills. It is not an emergency or medical service.</p>
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
      configured: Boolean(model),
      mode: 'structured-journal-analysis',
    });
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

    try {
      const analysis = await model.analyze(parsed.data);
      response.json({ analysis, safetyAction: 'continue' });
    } catch (error) {
      next(error);
    }
  });

  const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
    const requestId = request.headers['x-request-id'] ?? crypto.randomUUID();
    console.error(JSON.stringify({ level: 'error', requestId, path: request.path, message: error instanceof Error ? error.message : 'Unknown error' }));
    response.status(502).json({ error: 'model_unavailable', message: 'Journal analysis is temporarily unavailable', requestId });
  };
  app.use(errorHandler);

  return app;
}
