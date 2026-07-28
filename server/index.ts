import 'dotenv/config';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createGeminiModel } from './gemini.js';
import { createAccountService } from './account.js';
import { createKnowledgePackService } from './knowledge-pack.js';

const config = loadConfig();
const model = config.GEMINI_API_KEY
  ? createGeminiModel(config.GEMINI_API_KEY, config.GEMINI_MODEL, config.GEMINI_FALLBACK_MODEL)
  : undefined;
const accountService = config.SUPABASE_URL && config.SUPABASE_SERVICE_ROLE_KEY
  ? createAccountService(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY)
  : undefined;
const knowledgePackService = config.SUPABASE_URL && config.SUPABASE_SERVICE_ROLE_KEY
  ? createKnowledgePackService(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY)
  : undefined;
const app = createApp({ config, model, conversationModel: model, accountService, knowledgePackService });

app.listen(config.PORT, () => {
  console.log(`Within API listening on http://localhost:${config.PORT}`);
  if (!model) console.warn('GEMINI_API_KEY is not configured; AI requests will return 503');
});
