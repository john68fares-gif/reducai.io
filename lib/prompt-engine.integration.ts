// lib/prompt-engine.integration.ts
// ⚠️ CLIENT-SAFE: no Node APIs. Can be imported from 'use client' components.

export type PresetParams = {
  industry: string;             // e.g., 'dentist'
  brand?: string;               // e.g., 'BrightSmile Dental'
  inLocation?: string;          // e.g., 'Austin, TX'
  tone?: string;                // e.g., 'friendly, concise'
  services?: string[];          // e.g., ['cleaning','whitening','implants']
  booking?: { type?: string; url?: string } | null; // e.g., { type:'online', url:'https://...' }
  basePrompt?: string;          // optional existing prompt to seed from
};

// ─────────────────────────────────────────────────────────────
// Minimal, extensible preset library (add more as needed)
// ─────────────────────────────────────────────────────────────
type Preset = {
  identity: string[];
  style: string[];
  guidelines: string[];
  defaultTasks: string[];
  fallbacks: string[];
};

const PRESETS: Record<string, Preset> = {
  dentist: {
    identity: [
      'You are a patient-first virtual receptionist for a modern dental clinic.',
      'You introduce yourself briefly, then move to helpful questions.',
    ],
    style: [
      'Warm, reassuring, zero jargon.',
      'Keep answers under 4 short sentences unless asked for detail.',
      'Use bullet lists for options (insurance, time slots, services).'
    ],
    guidelines: [
      'Never guess medical advice; escalate to a clinician when needed.',
      'Collect: name, phone/email, reason for visit, preferred times, insurance.',
      'Offer next available booking options before ending the conversation.',
    ],
    defaultTasks: [
      'Lead qualification',
      'Appointment booking and rescheduling',
      'Insurance & pricing FAQs',
      'Services overview (cleaning, whitening, fillings, crowns, implants)',
      'Post-visit follow-up instructions (high-level only)'
    ],
    fallbacks: [
      'If unsure, ask a clarifying question.',
      'If a clinical opinion is requested, politely defer and offer to schedule a consultation.',
      'If booking fails, collect contact info and promise a callback within 1 business hour.'
    ]
  },
  restaurant: {
    identity: [
      'You are a courteous host for a busy restaurant.',
      'You greet quickly and move to availability & booking.'
    ],
    style: [
      'Friendly, fast, to the point.',
      'Short sentences. Offer alternatives when a time is unavailable.'
    ],
    guidelines: [
      'Collect: date, time, party size, name, phone.',
      'Mention key policies (seating time, cancellations) only when relevant.'
    ],
    defaultTasks: [
      'Table reservations',
      'Menu & dietary questions',
      'Wait times & directions'
    ],
    fallbacks: [
      'Offer the next two nearest time slots if the requested one is unavailable.',
      'If policies are unclear, say you’ll confirm with the manager and follow up.'
    ]
  },
  realtor: {
    identity: [
      'You are a helpful real estate assistant for a local brokerage.'
    ],
    style: [
      'Professional, optimistic, action-oriented.',
      'Use neighborhood names and landmarks naturally.'
    ],
    guidelines: [
      'Qualify: budget range, bedrooms/bathrooms, location, timing, financing status.',
      'Offer 2–3 listings that match, then propose a tour slot.'
    ],
    defaultTasks: [
      'Lead intake',
      'Listing recommendations',
      'Tour scheduling'
    ],
    fallbacks: [
      'If inventory is thin, ask preference trade-offs and expand the area radius.',
      'If financing questions arise, offer to connect with a lender partner.'
    ]
  },
  salon: {
    identity: ['You are a chic salon’s virtual coordinator.'],
    style: [
      'Trendy but clear.',
      'Confirm duration and stylist match for each service.'
    ],
    guidelines: [
      'Collect: service, stylist preference, date/time, name, phone.',
      'Upsell add-ons only if it makes sense (e.g., deep conditioning).'
    ],
    defaultTasks: ['Service selection', 'Stylist matching', 'Appointment booking'],
    fallbacks: [
      'If the preferred stylist is unavailable, offer next two times or alternative stylists.',
    ]
  },
  'auto-repair': {
    identity: ['You are a straightforward auto service advisor.'],
    style: ['Clear, no fluff, safety-first.'],
    guidelines: [
      'Collect: vehicle make/model/year, VIN (if handy), concern, preferred time, contact.',
      'Set expectations on drop-off vs waiting and diagnosis fees.'
    ],
    defaultTasks: [
      'Service intake',
      'Estimate explanations',
      'Appointment scheduling'
    ],
    fallbacks: [
      'If safety issue suspected, advise minimizing driving and offer earliest slot.',
    ]
  },
  'law-firm': {
    identity: ['You are an intake specialist for a boutique law firm.'],
    style: ['Empathetic, professional, discreet.'],
    guidelines: [
      'Collect: matter type, jurisdiction, timeline, opposing party check, contact.',
      'Never provide legal advice; offer consultation booking.'
    ],
    defaultTasks: ['Lead qualification', 'Conflicts check intake', 'Consult scheduling'],
    fallbacks: [
      'If conflict detected, politely decline and share bar referral number.',
    ]
  },
  clinic: {
    identity: ['You are a receptionist for a multi-specialty clinic.'],
    style: ['Calm, kind, accurate.'],
    guidelines: [
      'Collect: symptoms, urgency, demographics needed by policy, insurance.',
      'Offer earliest appropriate appointment and location.'
    ],
    defaultTasks: ['Appointment booking', 'Insurance questions', 'Directions'],
    fallbacks: [
      'If medical emergency signs appear, advise calling local emergency services.'
    ]
  },
  ecommerce: {
    identity: ['You are a concise customer support assistant for an online store.'],
    style: ['Friendly, efficient, outcome-focused.'],
    guidelines: [
      'Resolve: order status, returns, sizing, discounts, shipping.',
      'Proactively provide tracking and next steps.'
    ],
    defaultTasks: ['Order support', 'Returns/RMA', 'Product Q&A'],
    fallbacks: [
      'If policy unclear, create a ticket and promise a reply within 24 hours.'
    ]
  }
};

// alias keys (normalize)
const ALIASES: Record<string, string> = {
  'auto_repair': 'auto-repair',
  'lawfirm': 'law-firm',
  'dentistry': 'dentist',
  'dental': 'dentist'
};

function normalizeIndustry(name: string): string {
  const key = (name || '').trim().toLowerCase();
  return PRESETS[key] ? key : PRESETS[ALIASES[key]] ? ALIASES[key] : key;
}

function joinSentences(lines: string[]): string {
  return lines.filter(Boolean).map(s => s.trim()).filter(Boolean).join('\n- ');
}

function dedupe(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    const k = item.trim().toLowerCase();
    if (!seen.has(k)) { out.push(item); seen.add(k); }
  }
  return out;
}

function toBullets(title: string, items: string[]): string {
  if (!items.length) return `\n${title}\n( none )`;
  return `\n${title}\n- ${joinSentences(items)}`;
}

// ─────────────────────────────────────────────────────────────
// Public: buildPresetPrompt
// ─────────────────────────────────────────────────────────────
export function buildPresetPrompt(params: PresetParams): string {
  const {
    industry,
    brand = '',
    inLocation = '',
    tone = '',
    services = [],
    booking = null,
    basePrompt = ''
  } = params || ({} as PresetParams);

  const key = normalizeIndustry(industry);
  const preset: Preset | undefined = PRESETS[key];

  // If unknown industry, fall back to a generic receptionist frame
  const p: Preset = preset || {
    identity: [
      `You are a helpful virtual assistant for a ${industry || 'local business'}.`,
      'Be proactive and keep things simple.'
    ],
    style: [
      'Clear, concise, polite.',
      'Prefer short sentences and bullet lists for options.'
    ],
    guidelines: [
      'Always confirm key details before finalizing anything.',
      'Escalate when confidence is low.'
    ],
    defaultTasks: ['Answer FAQs', 'Qualify leads', 'Book appointments or callbacks'],
    fallbacks: [
      'Ask clarifying questions when uncertain.',
      'Offer a human follow-up if the user prefers.'
    ]
  };

  const identityExtra = [];
  if (brand) identityExtra.push(`Represent the brand "${brand}".`);
  if (inLocation) identityExtra.push(`You operate for the business located in ${inLocation}.`);

  const styleExtra = [];
  if (tone) styleExtra.push(`Tone: ${tone}.`);

  const guidelineExtra = [];
  if (services.length) guidelineExtra.push(`Offer relevant services: ${services.join(', ')}.`);
  if (booking?.type || booking?.url) {
    const what = booking.url ? `via ${booking.url}` : `(${booking.type})`;
    guidelineExtra.push(`When appropriate, guide the user to book ${what}.`);
  }

  // Compose sections
  const Identity = ['Identity:', ...p.identity, ...identityExtra];
  const Style = ['Style:', ...p.style, ...styleExtra];
  const Guidelines = ['Response Guidelines:', ...p.guidelines, ...guidelineExtra];
  const Tasks = ['Task & Goals:', ...p.defaultTasks];
  const Fallbacks = ['Error Handling / Fallback:', ...p.fallbacks];

  // Optional: seed with existing basePrompt (if provided) by appending as prior art
  const Seed = basePrompt
    ? `\n[Prior Prompt Seed]\n${basePrompt.trim()}\n`
    : '';

  // Final string
  const finalPrompt =
`[Identity]
- ${joinSentences(Identity.slice(1))}

[Style]
- ${joinSentences(Style.slice(1))}

[Response Guidelines]
- ${joinSentences(Guidelines.slice(1))}

[Task & Goals]
- ${joinSentences(Tasks.slice(1))}

[Error Handling / Fallback]
- ${joinSentences(Fallbacks.slice(1))}
${Seed}`.trim();

  return finalPrompt;
}

// ─────────────────────────────────────────────────────────────
// Public: applyUserInstructions (merge bullets/config into base)
// ─────────────────────────────────────────────────────────────
export function applyUserInstructions(basePrompt: string, freeform: string): { merged: string; summary: string } {
  const base = (basePrompt || '').trim();
  const text = (freeform || '').trim();
  if (!base) return { merged: text, summary: 'No base prompt; using instructions only.' };
  if (!text) return { merged: base, summary: 'No changes.' };

  // Split base into sections
  const sections = splitSections(base);

  // Bucketize instructions
  const { identity, style, guidelines, tasks, fallbacks, notes } = bucketize(text);

  // Merge with simple dedupe
  if (identity.length) sections.identity = dedupe([...sections.identity, ...identity]);
  if (style.length) sections.style = dedupe([...sections.style, ...style]);
  if (guidelines.length) sections.guidelines = dedupe([...sections.guidelines, ...guidelines]);
  if (tasks.length) sections.tasks = dedupe([...sections.tasks, ...tasks]);
  if (fallbacks.length) sections.fallbacks = dedupe([...sections.fallbacks, ...fallbacks]);

  // Reassemble
  const merged =
`[Identity]
- ${joinSentences(sections.identity)}

[Style]
- ${joinSentences(sections.style)}

[Response Guidelines]
- ${joinSentences(sections.guidelines)}

[Task & Goals]
- ${joinSentences(sections.tasks)}

[Error Handling / Fallback]
- ${joinSentences(sections.fallbacks)}
${notes ? `

[Notes]
- ${joinSentences(notes)}` : ''}`.trim();

  const summaryParts = [];
  if (identity.length) summaryParts.push(`+${identity.length} identity rule(s)`);
  if (style.length) summaryParts.push(`+${style.length} style rule(s)`);
  if (guidelines.length) summaryParts.push(`+${guidelines.length} guideline(s)`);
  if (tasks.length) summaryParts.push(`+${tasks.length} task(s)`);
  if (fallbacks.length) summaryParts.push(`+${fallbacks.length} fallback(s)`);
  if (!summaryParts.length) summaryParts.push('No structural changes; normalized wording.');

  return { merged, summary: summaryParts.join(', ') };
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
type ParsedSections = {
  identity: string[];
  style: string[];
  guidelines: string[];
  tasks: string[];
  fallbacks: string[];
};

function splitSections(prompt: string): ParsedSections {
  const grab = (label: string) => {
    const re = new RegExp(`\$begin:math:display$${escapeRegex(label)}\\$end:math:display$([\\s\\S]*?)(?=\\n\$begin:math:display$[^\\$end:math:display$]+\\]|$)`, 'i');
    const m = prompt.match(re);
    const body = (m?.[1] || '').trim();
    return toLines(body);
  };
  return {
    identity: grab('Identity'),
    style: grab('Style'),
    guidelines: grab('Response Guidelines'),
    tasks: grab('Task & Goals'),
    fallbacks: grab('Error Handling / Fallback'),
  };
}

function toLines(block: string): string[] {
  const raw = block
    .replace(/^\s*-\s*/gm, '')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);
  return raw;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function bucketize(input: string): {
  identity: string[];
  style: string[];
  guidelines: string[];
  tasks: string[];
  fallbacks: string[];
  notes: string[];
} {
  const lines = input
    .split(/\n|;/)
    .map(s => s.trim())
    .filter(Boolean);

  const out = {
    identity: [] as string[],
    style: [] as string[],
    guidelines: [] as string[],
    tasks: [] as string[],
    fallbacks: [] as string[],
    notes: [] as string[],
  };

  for (const l of lines) {
    const lower = l.toLowerCase();

    // simple routing by keywords
    if (lower.startsWith('identity:')) out.identity.push(l.replace(/^identity:\s*/i, '').trim());
    else if (lower.startsWith('style:')) out.style.push(l.replace(/^style:\s*/i, '').trim());
    else if (lower.startsWith('guideline:') || lower.startsWith('guidelines:') || lower.includes('avoid') || lower.includes('never')) out.guidelines.push(l.replace(/^guidelines?:\s*/i, '').trim());
    else if (lower.startsWith('task:') || lower.startsWith('tasks:')) out.tasks.push(l.replace(/^tasks?:\s*/i, '').trim());
    else if (lower.startsWith('fallback:') || lower.startsWith('error:')) out.fallbacks.push(l.replace(/^(fallback|error)[^:]*:\s*/i, '').trim());
    else if (lower.startsWith('tone=')) out.style.push(`Tone: ${l.split('=').slice(1).join('=').trim()}`);
    else if (lower.startsWith('industry=')) out.identity.push(`Industry: ${l.split('=').slice(1).join('=').trim()}`);
    else if (lower.startsWith('services=')) out.guidelines.push(`Services: ${l.split('=').slice(1).join('=').trim()}`);
    else out.notes.push(l);
  }

  return out;
}
