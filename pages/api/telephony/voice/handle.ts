// pages/api/telephony/voice/handle.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { runAgent, ensureAgent } from '@/server/voiceAgent'

const BASE_URL = 'https://reducai-io-eq4t-6uk48e7ek-john68fares-3902s-projects.vercel.app'

function twiml(xml: string) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${xml}</Response>`
}
function escapeXml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const phoneNumberId = (req.query.phoneNumberId as string) || (req.body?.phoneNumberId as string) || 'default'
  const speech = (req.body?.SpeechResult as string) || ''
  const digits = (req.body?.Digits as string) || ''
  const userText = speech || digits || ''

  // Require a configured agent (per-user API key)
  const agent = await ensureAgent(phoneNumberId)
  if (!agent) {
    const xml = twiml(`
      <Say voice="Polly.Joanna">This phone number is not configured yet. Please finish creating a voice agent in your dashboard.</Say>
      <Hangup/>
    `)
    res.setHeader('Content-Type', 'text/xml')
    res.status(200).send(xml)
    return
  }

  const reply = await runAgent(phoneNumberId, userText)
  const say = reply || "Sorry, I didn't catch that."

  const actionUrl = `${BASE_URL}/api/telephony/voice/handle?phoneNumberId=${encodeURIComponent(phoneNumberId)}`
  const xml = twiml(`
    <Say voice="Polly.Joanna">${escapeXml(say)}</Say>
    <Gather input="speech" action="${actionUrl}" method="POST" language="en-US" speechTimeout="auto">
      <Say voice="Polly.Joanna">Anything else?</Say>
    </Gather>
    <Say voice="Polly.Joanna">Thanks for calling. Goodbye!</Say>
    <Hangup/>
  `)

  res.setHeader('Content-Type', 'text/xml')
  res.status(200).send(xml)
}
