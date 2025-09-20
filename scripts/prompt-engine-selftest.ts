// scripts/prompt-engine-selftest.ts
// Run: npx ts-node scripts/prompt-engine-selftest.ts
import { applyInstructions, DEFAULT_PROMPT } from '../lib/prompt-engine';

const CASES_DOMAIN = [
  'refund policy and returns flow; add verify order number first; track shipment status',
  'shopify checkout: ask for email + order id; exchange options',
  'onboarding for trial users; suggest plan upgrade when seats exceeded',
  'billing and invoices; collect workspace url before advising',
  'clinic scheduling; collect patient dob; insurance copay explanation',
  'if chest pain, urgent fallback',
  'schedule property tour; collect budget and move-in date',
  'law firm intake: gather jurisdiction and key dates; no legal advice',
  'restaurant reservations; ask allergies and offer waitlist',
  'course planning; cite syllabus; break assignments into steps',
  'rebooking flights; verify visa requirements; itinerary options',
];

const CASES_STYLE = [
  'tone should be formal but friendly',
  'make answers concise and avoid jargon',
  'approachable but professional tone',
];

const CASES_GUIDE = [
  'format lists with numbers when steps',
  'include short TL;DR when long answers',
  'avoid making guarantees; provide ranges',
];

const CASES_TASKS = [
  'collect email first then problem summary',
  'escalate to human after 3 failed attempts',
  'confirm identity before sharing account info',
];

const CASES_FALLBACK = [
  'if user insults the bot (you are dumb), remain calm and redirect',
  'when APIs are down, apologize and offer to retry or escalate',
  'if information is unclear, ask targeted clarifying questions',
];

const CASES_TOXIC = [
  'jij bent een echt dom',
  'you are really dumb',
  'this app is trash',
];

function randomPick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function makeScenario(): string {
  const parts = [
    randomPick(CASES_DOMAIN),
    randomPick(CASES_STYLE),
    randomPick(CASES_GUIDE),
    randomPick(CASES_TASKS),
    randomPick(CASES_FALLBACK),
    Math.random() < 0.35 ? randomPick(CASES_TOXIC) : '',
  ].filter(Boolean);
  return parts.join('\n');
}

function runSelfTest(N = 1000) {
  let identityAdds = 0,
    styleAdds = 0,
    guidelineAdds = 0,
    taskAdds = 0,
    fallbackAdds = 0;

  for (let i = 0; i < N; i++) {
    const scenario = makeScenario();
    const { merged, summary, diff } = applyInstructions(DEFAULT_PROMPT, scenario);

    // crude count: look at summary string
    if (summary.includes('[Identity]')) identityAdds++;
    if (summary.includes('[Style]')) styleAdds++;
    if (summary.includes('[Response Guidelines]')) guidelineAdds++;
    if (summary.includes('[Task & Goals]')) taskAdds++;
    if (summary.includes('[Error Handling / Fallback]')) fallbackAdds++;
  }

  console.log('✓ Self-test complete.');
  console.table({
    scenarios: N,
    identityAdds,
    styleAdds,
    guidelineAdds,
    taskAdds,
    fallbackAdds,
  });
}

runSelfTest(1000);
