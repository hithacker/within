import type { PublishedKnowledgePack } from '../types/knowledgePack';

function isPublishedKnowledgePack(value: unknown): value is PublishedKnowledgePack {
  if (!value || typeof value !== 'object') return false;
  const pack = value as Partial<PublishedKnowledgePack>;
  return pack.schemaVersion === 1
    && typeof pack.id === 'string'
    && typeof pack.version === 'string'
    && typeof pack.title === 'string'
    && Array.isArray(pack.modules)
    && pack.modules.every((module) => module
      && typeof module.id === 'string'
      && typeof module.title === 'string'
      && typeof module.purpose === 'string'
      && Array.isArray(module.steps));
}

export async function loadPublishedKnowledgePack(packId: string): Promise<PublishedKnowledgePack> {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  if (!apiUrl) throw new Error('Skill collection API is not configured');

  const response = await fetch(`${apiUrl}/v1/collections/${encodeURIComponent(packId)}`);
  if (!response.ok) throw new Error(`Skill collection request failed: ${response.status}`);
  const body = await response.json() as { pack?: unknown };
  if (!isPublishedKnowledgePack(body.pack)) throw new Error('Skill collection response is invalid');
  return body.pack;
}
