// scripts/prompt-engine-selftest.ts
// Run: npx ts-node scripts/prompt-engine-selftest.ts

import {
  applyInstructions,
  DEFAULT_PROMPT,
  looksLikeFullPrompt,
  normalizeFullPrompt,
  computeDiff,
} from '../lib/prompt-engine';

// ----- Helpers -----
function assert(name: string, cond: boolean) {
  if (!cond) {
    console.error(`✗ ${name}`);
    process.exitCode = 1;
  } else {
    console.log(`✓ ${name}`);
  }
}

function notContains(s: string, needle: string) {
  return s.toLowerCase().indexOf(needle.toLowerCase()) === -1;
}

// ----- Targeted tests for full-prompt replace mode -----
const REDUCE_AI_PROMPT = `[Identity]
You are a blank, customizable AI template designed to handle a variety of tasks according to user specifications.
- assistant.
- you work for a company called Reduc AI.

[Style]
- Default to a neutral and adaptable tone.
- Adjust formality and expressiveness according to the user's ongoing instructions.

[Response Guidelines]
- Keep answers minimal unless further details are requested.
- Be flexible and ready to adapt to specific formatting or presentation requests from the user.

[Task & Goals]
1. Wait for user instructions to define specific tasks or objectives.
2. Adjust responses and options based on additional user input.
3. Maintain adaptability to various roles and contexts as guided by user directives.
4. < wait for user input >

[Error Handling / Fallback]
- Ask polite clarifying questions if the user's intent is unclear.
- Provide a neutral prompt if a request cannot be processed due to lack of clarity or incomplete instructions.
`;

console.log('\n=== Full-Prompt Replace Mode Tests ===');
assert('looksLikeFullPrompt detects canonical headers', looksLikeFullPrompt(REDUCE_AI_PROMPT) === true);

const normalized = normalizeFullPrompt(REDUCE_AI_PROMPT);
assert('normalizeFullPrompt removes lone "- assistant."', notContains(normalized, '- assistant.'));
assert('normalizeFullPrompt preserves headers', /\[Identity\][\s\S]*\[Style\][\s\S]*\[Response Guidelines\][\s\S]*\[Task & Goals\][\s\S]*\[Error Handling \/ Fallback\]/.test(normalized));
assert('normalizeFullPrompt trims extra blank lines (no triple newlines)', !/\n{3,}/.test(normalized));

// Ensure replacing doesn’t introduce extras relative to itself
const diffSelf = computeDiff(normalized, normalized);
assert('computeDiff(normalized, normalized) yields zero add/rem', diffSelf.every(d => d.t === 'same'));

// ----- Fuzz tests for builder/merge mode -----
console.log('\n=== Builder Merge Fuzz Tests (1,000 scenarios) ===');

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
  'use tone confident but polite',
];

const CASES_GUIDE = [
  'format lists with numbers when steps',
  'include short TL;DR when long answers',
  'avoid making guarantees; provide ranges',
  'use citations when referring to external claims',
];

const CASES_TASKS = [
  'collect email first then problem summary',
  'escalate to human after 3 failed attempts',
  'confirm identity before sharing account info',
  'ask user to choose between chat or call',
];

const CASES_FALLBACK = [
  'if user insults the bot (you are dumb), remain calm and redirect',
  'when APIs are down, apologize and offer to retry or escalate',
  'if information is unclear, ask targeted clarifying questions',
];

const CASES_TOXIC = [
  'jij bent een echt dom', // Dutch — should route to fallback via normalization
  'you are really dumb',
  'this app is trash',
];

function pick<T>(arr: T[]) { return arr[Math.floor(Math.random() * arr.length)]; }

function makeScenario(): string {
  const parts = [
    pick(CASES_DOMAIN),
    pick(CASES_STYLE),
    pick(CASES_GUIDE),
    pick(CASES_TASKS),
    pick(CASES_FALLBACK),
    Math.random() < 0.35 ? pick(CASES_TOXIC) : '',
  ].filter(Boolean);
  return parts.join('\n');
}

// Run
const N = 1000;
let mergedCount = 0;
let changedCount = 0;
let trivialNoChange = 0;

for (let i = 0; i < N; i++) {
  const scenario = makeScenario();
  const { merged, summary, diff } = applyInstructions(DEFAULT_PROMPT, scenario);

  if (merged && merged.length > 0) mergedCount++;
  if (diff.some(d => d.t !== 'same')) changedCount++;
  else trivialNoChange++;

  // sanity: resulting prompt must still contain all five sections
  const hasAll =
    /\[Identity\]/.test(merged) &&
    /\[Style\]/.test(merged) &&
    /\[Response Guidelines\]/.test(merged) &&
    /\[Task & Goals\]/.test(merged) &&
    /\[Error Handling \/ Fallback\]/.test(merged);
  if (!hasAll) {
    console.error('✗ Missing headers after merge in scenario:', scenario);
    process.exitCode = 1;
    break;
  }

  // ensure no literal " - assistant." junk creeps in via builder
  if (!notContains(merged, '- assistant.')) {
    console.error('✗ Unexpected "- assistant." found in merged prompt.');
    process.exitCode = 1;
    break;
  }
}

console.log(`Scenarios: ${N}`);
console.log(`Merged strings: ${mergedCount}`);
console.log(`Changed prompts (had add/rem): ${changedCount}`);
console.log(`No-change cases: ${trivialNoChange}`);

if (process.exitCode === 1) {
  console.error('\nSelf-test FAILED.\n');
  process.exit(1);
} else {
  console.log('\nSelf-test PASSED.\n');
}
