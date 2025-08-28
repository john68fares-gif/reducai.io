// lib/agentConfig.ts
export type AgentConfig = {
  phoneNumberId: string;
  name: string;
  greeting: string;       // first spoken line on answer
  systemPrompt: string;   // your builder prompt
};

export async function getAgentConfigForPhone(phoneNumberId: string): Promise<AgentConfig> {
  // TODO: replace with your DB lookup. Example (Prisma):
  // const row = await prisma.agent.findUnique({ where: { phoneNumberId } });

  // Quick fallback if you’re still wiring persistence:
  return {
    phoneNumberId,
    name: process.env.AGENT_NAME ?? 'Voice Agent',
    greeting:
      process.env.AGENT_GREETING ??
      "Hi! You're speaking with our AI assistant. How can I help today?",
    systemPrompt:
      process.env.AGENT_SYSTEM_PROMPT ??
      "You are a helpful, concise voice assistant for our company. " +
      "Answer clearly in one or two short sentences. If unsure, ask a clarifying question.",
  };
}
