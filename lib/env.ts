// lib/env.ts
export const env = {
  // Supabase (server)
  SUPABASE_URL:
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  SUPABASE_ANON_KEY:
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',

  // Optional server default OpenAI key (only used if client didn't send one)
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
};

export function assertServerEnv() {
  if (!env.SUPABASE_URL) throw new Error('Server missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL).');
  if (!env.SUPABASE_ANON_KEY) throw new Error('Server missing SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY).');
}
