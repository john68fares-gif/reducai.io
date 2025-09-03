// lib/supabase-admin.ts
import { createClient } from '@supabase/supabase-js';

// IMPORTANT: only import this file from API routes / server code.
// It uses the Service Role key (never expose to the browser).
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
