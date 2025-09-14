// pages/api/agents/index.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { upsertAgent, getAgentByPhoneNumberId, Agent } from '@/lib/store'

// NOTE: Add real auth here. Right now this trusts the caller (your dashboard).
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const {
      id,
      ownerId,
      phoneNumberId,
      prompt,
      model = 'gpt-4o-mini',
      openaiApiKey,
      enabled = true,
    } = req.body || {}

    if (!id || !ownerId || !phoneNumberId || !prompt || !openaiApiKey) {
      res.status(400).json({ ok: false, error: 'Missing required fields.' })
      return
    }

    const saved = await upsertAgent({
      id,
      ownerId,
      phoneNumberId,
      prompt,
      model,
      openaiApiKey,
      enabled,
    })

    res.status(200).json({ ok: true, data: { ...saved, openaiApiKey: '***' } })
    return
  }

  if (req.method === 'GET') {
    const phoneNumberId = (req.query.phoneNumberId as string) || ''
    if (!phoneNumberId) {
      res.status(400).json({ ok: false, error: 'phoneNumberId required' })
      return
    }

    const agent = await getAgentByPhoneNumberId(phoneNumberId)
    if (!agent) {
      res.status(404).json({ ok: false, error: 'Not found' })
      return
    }

    const masked: Agent & { openaiApiKey: string } = { ...agent, openaiApiKey: '***' }
    res.status(200).json({ ok: true, data: masked })
    return
  }

  res.setHeader('Allow', ['GET', 'POST'])
  res.status(405).end('Method Not Allowed')
}
