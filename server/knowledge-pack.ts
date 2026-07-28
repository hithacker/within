import { createClient } from '@supabase/supabase-js';
import { knowledgePackContentSchema, type KnowledgePackContent } from './knowledge-pack-schema.js';

export interface KnowledgePackService {
  getPublishedPack(packId: string, version?: string): Promise<KnowledgePackContent | null>;
}

export function createKnowledgePackService(supabaseUrl: string, serviceRoleKey: string): KnowledgePackService {
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return {
    async getPublishedPack(packId, version) {
      let query = supabase
        .from('knowledge_pack_versions')
        .select('content')
        .eq('pack_id', packId)
        .eq('status', 'published');

      if (version) query = query.eq('version', version);
      else query = query.order('published_at', { ascending: false });

      const { data, error } = await query.limit(1).maybeSingle();
      if (error) throw error;
      if (!data) return null;

      return knowledgePackContentSchema.parse(data.content);
    },
  };
}
