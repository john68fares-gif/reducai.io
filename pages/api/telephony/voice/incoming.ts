// pages/api/telephony/voice/incoming.ts
import type { NextApiRequest, NextApiResponse } from 'next'

const BASE_URL = 'https://reducai-io-eq4t-6uk48e7ek-john68fares-3902s-projects.vercel.app'

function twiml(xml: string) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${xml}</Response>`
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Twilio sends x-www-form-urlencoded. Next usually parses it; be defensive:
  const to = (req.body?.To as string) || (req.query?.To as string) || ''
  const calledSid = (req.body?.CalledSid as string) || (req.query?.CalledSid as string) || ''
  const phoneNumberId = calledSid || to || 'default'

  const actionUrl = `${BASE_URL}/api/telephony/voice/handle?phoneNumberId=${encodeURIComponent(
    phoneNumberId
  )}`

  const greeting =
    'Hey! You’re speaking with Reduc AI. How can I help you today?'

  const xml = twiml(`
    <Say voice="Polly.Joanna">${greeting}</Say>
    <Gather input="speech" action="${actionUrl}" method="POST" language="en-US" speechTimeout="auto">
      <Say voice="Polly.Joanna">I’m listening… please speak after the tone.</Say>
    </Gather>
    <Say voice="Polly.Joanna">I didn’t catch that. Goodbye!</Say>
    <Hangup/>
  `)

  res.setHeader('Content-Type', 'text/xml')
  res.status(200).send(xml)
}
