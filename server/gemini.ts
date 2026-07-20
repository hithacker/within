import { GoogleGenAI, HarmBlockThreshold, HarmCategory } from '@google/genai';
import { JOURNAL_ANALYSIS_SYSTEM_PROMPT } from './prompt.js';
import { journalAnalysisSchema, journalModelOutputSchema, type JournalAnalysis, type JournalAnalysisRequest, type JournalModelOutput } from './schema.js';

export interface JournalModel {
  analyze(request: JournalAnalysisRequest): Promise<JournalAnalysis>;
}

function parseJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

const prohibitedInsightLanguage = /\b(?:diagnos(?:e|ed|is)|narcissist(?:ic)?|toxic|abusive|dangerous|you should (?:leave|break up|end)|will (?:fail|end badly))\b/i;

export function normalizeAnalysis(analysis: JournalModelOutput, request: JournalAnalysisRequest): JournalAnalysis {
  const validIds = new Set(request.entries.map((entry) => entry.id));
  const patterns = analysis.patterns.flatMap((pattern) => {
    const evidenceEntryIds = [...new Set(pattern.evidenceEntryIds)].filter((id) => validIds.has(id));
    const userFacingText = `${pattern.title} ${pattern.observation} ${pattern.goalConnection}`;
    if (evidenceEntryIds.length < 2 || prohibitedInsightLanguage.test(userFacingText)) return [];
    return [{ ...pattern, evidenceEntryIds }];
  });

  return journalAnalysisSchema.parse({ ...analysis, patterns });
}

function providerStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const candidate = error as { status?: unknown; code?: unknown };
  const value = candidate.status ?? candidate.code;
  return typeof value === 'number' ? value : undefined;
}

function providerMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isQuotaError(error: unknown): boolean {
  return providerStatus(error) === 429 || /(?:quota|resource_exhausted|rate limit)/i.test(providerMessage(error));
}

export function isTransientProviderError(error: unknown): boolean {
  const status = providerStatus(error);
  return status === 503 || status === 429 || /(?:unavailable|high demand|temporar|resource_exhausted)/i.test(providerMessage(error));
}

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export function createGeminiModel(apiKey: string, model: string, fallbackModel?: string): JournalModel {
  const ai = new GoogleGenAI({ apiKey });

  return {
    async analyze(request) {
      const models = [...new Set([model, fallbackModel].filter((value): value is string => Boolean(value)))];
      let lastError: unknown;

      for (const candidateModel of models) {
        const attempts = candidateModel === model ? 1 : 2;
        for (let attempt = 0; attempt < attempts; attempt += 1) {
          try {
            const response = await ai.models.generateContent({
              model: candidateModel,
              contents: [{ role: 'user', parts: [{ text: JSON.stringify(request) }] }],
              config: {
                systemInstruction: JOURNAL_ANALYSIS_SYSTEM_PROMPT,
                responseMimeType: 'application/json',
                temperature: 0.15,
                topP: 0.8,
                maxOutputTokens: 1_200,
                thinkingConfig: { thinkingBudget: 0 },
                safetySettings: [
                  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                ],
              },
            });

            const text = response.text?.trim();
            if (!text) throw new Error('Gemini returned an empty or blocked response');

            const parsed = journalModelOutputSchema.parse(parseJson(text));
            return normalizeAnalysis(parsed, request);
          } catch (error) {
            lastError = error;
            const canRetry = attempt + 1 < attempts && isTransientProviderError(error);
            if (canRetry) {
              await wait(750 * (attempt + 1));
              continue;
            }
            break;
          }
        }

        if (!isQuotaError(lastError) && !isTransientProviderError(lastError)) break;
      }

      throw lastError;
    },
  };
}
