// pages/api/voice/agents.ts
import type { NextApiRequest, NextApiResponse } from 'next';

// very simple in-memory “db” so the value survives hot reloads
// (globalThis is shared across reloads in dev)
type AgentRecord = {
  agentId: string;
  prompt: string;
  language?: string;
  voice?: string;
  fromNumber?: string; // we only record it here; attaching is done in another route
  createdAt: number;
};
declare global {
  // eslint-disable-next-line no-var
  var __AGENTS__: Map<string, AgentRecord> | undefined;
}
const AGENTS = (global.__AGENTS__ ||= new Map<string, AgentRecord>());

function bad(res: NextApiResponse, code: number, message: string, details?: any) {
  return res
    .status(code)
    .json({ ok: false, error: { code: String(code), message, details } });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return bad(res, 405, 'Method not allowed');
    }

    // Accept JSON only
    if (!req.headers['content-type']?.includes('application/json')) {
      return bad(res, 415, 'Use application/json');
    }

    const { agentId, prompt, language, voice, fromNumber } = (req.body || {}) as {
      agentId?: string;
      prompt?: string;
      language?: string;
      voice?: string;
      fromNumber?: string;
    };

    // Basic validation so users must provide real inputs
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 10) {
      return bad(res, 400, 'Prompt is required and must be at least 10 characters.', {
        field: 'prompt',
      });
    }

    // Generate an id if not provided by your Builder
    const id =
      (agentId && String(agentId)) ||
      'agent_' +
        Math.random().toString(36).slice(2, 8) +
        Date.now().toString(36).slice(-6);

    const record: AgentRecord = {
      agentId: id,
      prompt: prompt.trim(),
      language: language || 'en-US',
      voice: voice || 'Polly.Joanna',
      fromNumber: fromNumber || undefined,
      createdAt: Date.now(),
    };

    AGENTS.set(id, record);

    // Always return JSON
    return res.status(200).json({
      ok: true,
      data: {
        agentId: id,
        saved: true,
        hasFromNumber: !!fromNumber,
      },
    });
  } catch (err: any) {
    return bad(res, 500, err?.message || 'Unexpected server error');
  }
}

// Optional helper GET to debug in dev (not used by UI but handy)
// curl /api/voice/agents?id=agent_xxx
export const config = { api: { bodyParser: true } };
