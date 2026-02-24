import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export type ManagedFile = {
  id: string;
  original_name: string;
  mime_type: string | null;
  size_bytes: number;
  storage_path: string;
  created_at: string;
};

export const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
