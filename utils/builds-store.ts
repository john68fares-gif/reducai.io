// utils/builds-store.ts
import { supabase } from '@/lib/supabase-client';

export type BuildRecord = {
  id: string;              // uuid
  assistant_id: string;
  user_id: string;
  name: string;
  payload: any;            // { type, industry, language, model, prompt, createdAt, updatedAt, appearance }
  created_at: string;
  updated_at: string;
};

export async function upsertBuildToSupabase(build: {
  assistantId: string;
  name: string;
  payload: any;
}) {
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) throw new Error('No auth user');

  const { data, error } = await supabase
    .from('chatbots')
    .upsert({
      assistant_id: build.assistantId,
      user_id: user.id,
      name: build.name,
      payload: build.payload,
    }, { onConflict: 'assistant_id' })
    .select()
    .single();

  if (error) throw error;
  return data as BuildRecord;
}

export async function fetchBuildsFromSupabase() {
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) throw new Error('No auth user');

  const { data, error } = await supabase
    .from('chatbots')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data || []) as BuildRecord[];
}
