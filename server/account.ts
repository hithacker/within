import { createClient } from '@supabase/supabase-js';

export interface AccountService {
  deleteAccount(accessToken: string): Promise<void>;
}

export function createAccountService(url: string, serviceRoleKey: string): AccountService {
  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return {
    async deleteAccount(accessToken) {
      const { data, error: userError } = await supabase.auth.getUser(accessToken);
      if (userError || !data.user) throw new Error('invalid_access_token');

      const { error: deleteError } = await supabase.auth.admin.deleteUser(data.user.id);
      if (deleteError) throw deleteError;
    },
  };
}
