import 'dotenv/config';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createGeminiModel } from './gemini.js';

const config = loadConfig();
const model = config.GEMINI_API_KEY
  ? createGeminiModel(config.GEMINI_API_KEY, config.GEMINI_MODEL, config.GEMINI_FALLBACK_MODEL)
  : undefined;
const app = createApp({ config, model });

app.listen(config.PORT, () => {
  console.log(`Within API listening on http://localhost:${config.PORT}`);
  if (!model) console.warn('GEMINI_API_KEY is not configured; AI requests will return 503');
});
