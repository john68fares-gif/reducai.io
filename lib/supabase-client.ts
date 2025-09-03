// lib/supabase-client.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,       // safe to expose
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!   // safe to expose
);
