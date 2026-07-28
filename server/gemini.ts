import { GoogleGenAI, HarmBlockThreshold, HarmCategory } from '@google/genai';
import { buildSkillAnalysisPrompt, buildSkillDiscoveryPrompt } from './prompt.js';
import {
  conversationModelOutputSchema,
  journalAnalysisSchema,
  journalModelOutputSchema,
  skillDiscoveryOutputSchema,
  type ConversationRequest,
  type ConversationResponse,
  type JournalAnalysis,
  type JournalAnalysisRequest,
  type JournalModelOutput,
} from './schema.js';
import type { KnowledgePackContent } from './knowledge-pack-schema.js';
import { CONSCIENTIOUS_CONVERSATION_PROMPT } from './conversation-prompt.js';
import { normalizeConversationOutput, selectRelevantMemories } from './memory.js';

export interface JournalModel {
  analyze(request: JournalAnalysisRequest, collection: KnowledgePackContent): Promise<JournalAnalysis>;
}

export interface ConversationModel {
  respond(request: ConversationRequest): Promise<ConversationResponse>;
}

export type WithinModel = JournalModel & ConversationModel;

function parseJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

const prohibitedInsightLanguage = /\b(?:diagnos(?:e|ed|is)|narcissist(?:ic)?|toxic|abusive|dangerous|you should (?:leave|break up|end)|will (?:fail|end badly))\b/i;

export function normalizeAnalysis(
  analysis: JournalModelOutput,
  request: JournalAnalysisRequest,
  collection: KnowledgePackContent,
  selectedSkillIds: string[],
): JournalAnalysis {
  const validEntryIds = new Set(request.entries.map((entry) => entry.id));
  const allowedSkills = new Set(selectedSkillIds);
  const patternsById = new Map(collection.patterns.map((pattern) => [pattern.id, pattern]));

  const patterns = analysis.patterns.flatMap((candidate) => {
    const definition = patternsById.get(candidate.id);
    if (!definition || !allowedSkills.has(definition.moduleId)) return [];

    const evidenceEntryIds = [...new Set(candidate.evidenceEntryIds)].filter((id) => validEntryIds.has(id));
    const userFacingText = `${candidate.observation} ${candidate.goalConnection}`;
    if (evidenceEntryIds.length < definition.minimumEvidenceEntries || prohibitedInsightLanguage.test(userFacingText)) return [];

    return [{
      ...candidate,
      id: definition.id,
      category: definition.category,
      title: definition.title,
      skillId: definition.moduleId,
      collectionId: collection.id,
      collectionVersion: collection.version,
      evidenceEntryIds,
    }];
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

export function createGeminiModel(apiKey: string, model: string, fallbackModel?: string): WithinModel {
  const ai = new GoogleGenAI({ apiKey });
  const models = [...new Set([model, fallbackModel].filter((value): value is string => Boolean(value)))];

  async function generate(systemInstruction: string, payload: unknown, maxOutputTokens: number): Promise<unknown> {
    let lastError: unknown;
    for (const candidateModel of models) {
      const attempts = candidateModel === model ? 1 : 2;
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
          const response = await ai.models.generateContent({
            model: candidateModel,
            contents: [{ role: 'user', parts: [{ text: JSON.stringify(payload) }] }],
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              temperature: 0.1,
              topP: 0.8,
              maxOutputTokens,
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
          return parseJson(text);
        } catch (error) {
          lastError = error;
          if (attempt + 1 < attempts && isTransientProviderError(error)) {
            await wait(750 * (attempt + 1));
            continue;
          }
          break;
        }
      }
      if (!isQuotaError(lastError) && !isTransientProviderError(lastError)) break;
    }
    throw lastError;
  }

  return {
    async respond(request) {
      const latestMessage = request.messages.at(-1)!;
      const relevantMemories = selectRelevantMemories(
        request.memories,
        latestMessage.content,
        request.summary?.text,
      );
      const output = conversationModelOutputSchema.parse(
        await generate(CONSCIENTIOUS_CONVERSATION_PROMPT, {
          messages: request.messages,
          summary: request.summary,
          relevantMemories,
        }, 2_200),
      );
      return normalizeConversationOutput(output, request);
    },
    async analyze(request, collection) {
      const discovery = skillDiscoveryOutputSchema.parse(
        await generate(buildSkillDiscoveryPrompt(collection), request, 200),
      );
      const knownSkillIds = new Set(collection.modules.map((skill) => skill.id));
      const selectedSkillIds = [...new Set(discovery.skillIds)].filter((id) => knownSkillIds.has(id)).slice(0, 3);

      const output = journalModelOutputSchema.parse(
        await generate(buildSkillAnalysisPrompt(collection, selectedSkillIds), request, 1_200),
      );
      return normalizeAnalysis(output, request, collection, selectedSkillIds);
    },
  };
}
