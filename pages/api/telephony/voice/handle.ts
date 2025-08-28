// pages/api/telephony/voice/handle.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { runAgent, getPromptForPhone } from '../../../server/voiceAgent'

const BASE_URL = 'https://reducai-io-eq4t-6uk48e7ek-john68fares-3902s-projects.vercel.app'

function twiml(xml: string) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${xml}</Response>`
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const phoneNumberId =
    (req.query.phoneNumberId as string) ||
    (req.body?.phoneNumberId as string) ||
    'default'

  // Twilio fields (x-www-form-urlencoded)
  const speech = (req.body?.SpeechResult as string) || ''
  const digits = (req.body?.Digits as string) || ''
  const userText = speech || digits || ''

  // Get the prompt config you built in the UI (here: simple mapper)
  const systemPrompt = getPromptForPhone(phoneNumberId)

  // Generate an assistant reply (uses OpenAI if OPENAI_API_KEY is set, else falls back)
  const assistantText = await runAgent(systemPrompt, userText)

  // Continue the conversation with another Gather
  const actionUrl = `${BASE_URL}/api/telephony/voice/handle?phoneNumberId=${encodeURIComponent(
    phoneNumberId
  )}`

  const xml = twiml(`
    <Say voice="Polly.Joanna">${escapeXml(assistantText)}</Say>
    <Gather input="speech" action="${actionUrl}" method="POST" language="en-US" speechTimeout="auto">
      <Say voice="Polly.Joanna">Anything else?</Say>
    </Gather>
    <Say voice="Polly.Joanna">Thanks for calling. Goodbye!</Say>
    <Hangup/>
  `)

  res.setHeader('Content-Type', 'text/xml')
  res.status(200).send(xml)
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
