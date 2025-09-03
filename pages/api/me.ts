// /pages/api/me.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabaseClient';

type Ok = {
  ok: true;
  session: any | null;
  profile: any | null;
  accounts: Array<{ id: string; name: string }> | null;
};
type Err = { ok: false; error: string };

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse<Ok | Err>
) {
  try {
    const { data: { session }, error: sErr } = await supabase.auth.getSession();
    if (sErr) throw sErr;

    if (!session) {
      return res.status(200).json({ ok: true, session: null, profile: null, accounts: null });
    }

    const userId = session.user.id as string;

    const { data: profile, error: pErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (pErr) throw pErr;

    const { data: accounts, error: aErr } = await supabase
      .from('accounts')
      .select('id,name,account_members!inner(user_id)')
      .eq('account_members.user_id', userId)
      .order('created_at', { ascending: true });
    if (aErr) throw aErr;

    const compact = (accounts || []).map((a: any) => ({ id: a.id, name: a.name }));

    return res.status(200).json({ ok: true, session, profile, accounts: compact });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'Server error' });
  }
}
