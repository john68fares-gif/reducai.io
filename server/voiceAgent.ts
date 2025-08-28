// server/voiceAgent.ts
import { getAgentByPhoneNumberId } from '@/lib/store'

export async function ensureAgent(phoneNumberId: string) {
  const agent = await getAgentByPhoneNumberId(phoneNumberId)
  if (!agent || !agent.enabled || !agent.openaiApiKey) return null
  return agent
}

export async function runAgent(phoneNumberId: string, userText: string): Promise<string> {
  const agent = await ensureAgent(phoneNumberId)
  if (!agent) {
    // No configured agent: return nullish signal, caller handles TwiML messaging.
    return ''
  }

  if (!agent.openaiApiKey) {
    return "I'm missing an API key for this agent."
  }

  const body = {
    model: agent.model || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: agent.prompt },
      { role: 'user', content: userText || 'Greet the caller.' },
    ],
    temperature: 0.6,
    max_tokens: 180,
  }

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${agent.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const json = await resp.json()
    const text =
      json?.choices?.[0]?.message?.content?.toString().trim() ||
      'Sorry, I had trouble generating a reply.'
    return text
  } catch {
    return "I'm having trouble right now. Please try again."
  }
}
