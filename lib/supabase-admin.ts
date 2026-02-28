import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export type Database = {
  public: {
    Tables: {
      files: {
        Row: {
          id: string;
          original_name: string;
          mime_type: string | null;
          size_bytes: number;
          storage_path: string;
          ai_summary: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          original_name: string;
          mime_type?: string | null;
          size_bytes: number;
          storage_path: string;
          ai_summary?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          original_name?: string;
          mime_type?: string | null;
          size_bytes?: number;
          storage_path?: string;
          ai_summary?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type ManagedFile = {
  id: string;
  original_name: string;
  mime_type: string | null;
  size_bytes: number;
  storage_path: string;
  ai_summary?: string | null;
  created_at: string;
};

let supabaseAdminClient: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseAdmin() {
  if (supabaseAdminClient) return supabaseAdminClient;

  if (!env.supabaseUrl) {
    throw new Error("Missing required environment variable: SUPABASE_URL");
  }
  if (!env.supabaseServiceRoleKey) {
    throw new Error("Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY");
  }

  supabaseAdminClient = createClient<Database>(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  return supabaseAdminClient;
}

export function getStorageBucket() {
  if (!env.supabaseStorageBucket) {
    throw new Error("Missing required environment variable: SUPABASE_STORAGE_BUCKET");
  }
  return env.supabaseStorageBucket;
}
