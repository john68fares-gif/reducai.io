// server/voiceAgent.ts
// Minimal "voice agent" that uses your builder prompt.
// If OPENAI_API_KEY is set, it will use OpenAI; otherwise it echoes politely.

type PhonePromptMap = Record<string, string>

// TODO: replace this with your real Builder storage lookup
const PROMPTS: PhonePromptMap = {
  // Map Twilio CalledSid or E.164 to a builder prompt
  default:
    "You are Reduc AI's helpful voice agent. Be concise, friendly, and ask one question at a time.",
}

// Grab the prompt for a phone number (fallback to default)
export function getPromptForPhone(phoneNumberId: string): string {
  return PROMPTS[phoneNumberId] || PROMPTS.default
}

export async function runAgent(systemPrompt: string, userText: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY

  // No LLM? Fallback behavior so calls still work.
  if (!apiKey) {
    if (!userText) return "Sorry, I didn't hear anything. Could you repeat that?"
    return `You said: "${userText}". How else can I help?`
  }

  // With OpenAI (SDK-less fetch to avoid adding deps)
  const body = {
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userText || 'Greet the caller.' },
    ],
    temperature: 0.6,
    max_tokens: 180,
  }

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
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
