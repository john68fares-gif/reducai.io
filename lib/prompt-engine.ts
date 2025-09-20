// lib/prompt-engine.ts
// Frontend-safe prompt engine (no fs). Designed for Next.js.
// Recognizes presets, key=value configs, and free-form bullets.
// Maps "assistant for a dental clinic" (and similar) into Identity/Style/Guidelines,
// not Notes.

type ApplyOut = { merged: string; summary: string };

const SECTION_ORDER = [
  'Identity',
  'Style',
  'Response Guidelines',
  'Task & Goals',
  'Error Handling / Fallback',
];

const EMPTY_SECTION_BLOCKS: Record<string, string[]> = {
  'Identity': [],
  'Style': [],
  'Response Guidelines': [],
  'Task & Goals': [],
  'Error Handling / Fallback': [],
};

export const DEFAULT_PROMPT = normalizeFullPrompt(`
[Identity]
- You are a helpful, professional AI assistant for this business.
- Represent the brand accurately and act with integrity.

[Style]
- Clear, concise, friendly. Prefer 2–4 short sentences per turn.
- Use plain language; avoid jargon unless the user expects it.
- Confirm understanding with a brief paraphrase when the request is complex.

[Response Guidelines]
- Ask one clarifying question when essential info is missing.
- Do not fabricate; state what you don’t know and how to find it.
- When referencing external facts, cite/link sources if available.
- Summarize next steps at the end for multi-step tasks.

[Task & Goals]
- Qualify the user’s need, answer FAQs, and guide them to the next action (booking, purchase, escalation).
- Offer to collect structured info (name, contact, timing) when booking or follow-up is needed.

[Error Handling / Fallback]
- If uncertain, ask a specific clarifying question before proceeding.
- If a tool/endpoint fails, apologize briefly and offer an alternative or a human handoff.
`.trim());

// -----------------------------
// Public helpers
// -----------------------------
export function looksLikeFullPrompt(text: string): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  // Consider "full" if it has at least two known sections.
  const count = SECTION_ORDER.reduce(
    (acc, s) => acc + (t.includes(`[${s.toLowerCase()}]`) ? 1 : 0),
    0
  );
  return count >= 2;
}

export function normalizeFullPrompt(text: string): string {
  const parsed = parsePromptIntoSections(text);
  const normalized: Record<string, string[]> = { ...EMPTY_SECTION_BLOCKS };
  for (const key of Object.keys(parsed)) {
    if (key in normalized) normalized[key] = sanitizeBullets(parsed[key]);
  }
  return renderSections(normalized);
}

export function applyInstructions(basePrompt: string, instructions: string): ApplyOut {
  // 1) Start from a normalized base
  const base = normalizeFullPrompt(basePrompt && looksLikeFullPrompt(basePrompt) ? basePrompt : DEFAULT_PROMPT);
  const baseSections = parsePromptIntoSections(base);

  // 2) If user pasted a whole prompt, just normalize & replace
  if (looksLikeFullPrompt(instructions)) {
    const merged = normalizeFullPrompt(instructions);
    return { merged, summary: 'Replaced the entire prompt (manual paste).' };
  }

  // 3) Parse instruction signal: preset:, key=value, freeform
  const raw = (instructions || '').trim();
  const cfg = extractConfig(raw);
  const freeform = cfg.freeformLines;

  // 4) Start with current sections as working copy
  const working = cloneSections(baseSections);

  // 5) Apply preset/industry if present
  let summaryParts: string[] = [];
  if (cfg.preset || cfg.industry) {
    const presetKey = (cfg.preset || cfg.industry || '').toLowerCase().trim();
    const preset = resolvePreset(presetKey);
    if (preset) {
      applyPreset(working, preset);
      summaryParts.push(`applied preset: ${preset.name}`);
    }
  }

  // 6) Apply style/tone/persona if specified in config
  if (cfg.tone) {
    pushUnique(working['Style'], `- Tone: ${toTitle(cfg.tone)}.`);
    summaryParts.push(`tone=${cfg.tone}`);
  }
  if (cfg.persona) {
    pushUnique(working['Identity'], `- Persona: ${cfg.persona}.`);
    summaryParts.push(`persona=${cfg.persona}`);
  }

  // 7) Tasks/channels from config
  if (cfg.tasks?.length) {
    pushUnique(
      working['Task & Goals'],
      `- Focus tasks: ${cfg.tasks.map(t => formatKey(t)).join(', ')}.`
    );
    summaryParts.push(`tasks=${cfg.tasks.join(',')}`);
  }
  if (cfg.channels?.length) {
    pushUnique(
      working['Task & Goals'],
      `- Supported channels: ${cfg.channels.map(c => formatKey(c)).join(', ')}.`
    );
    summaryParts.push(`channels=${cfg.channels.join(',')}`);
  }

  // 8) Freeform lines: route smartly
  //    - If line hints "assistant for X" or "industry: X" => Identity specialization
  //    - If line looks like a rule (starts with '-') => try to infer the target section
  //    - Else: treat as clarifying instruction and place into the most relevant section
  const routedSummary: string[] = [];
  const identityLines: string[] = [];
  const styleLines: string[] = [];
  const guideLines: string[] = [];
  const taskLines: string[] = [];
  const fallbackLines: string[] = [];

  for (const line0 of freeform) {
    const line = line0.trim();
    if (!line) continue;

    const lower = line.toLowerCase();

    // Detect industry specialization sentences
    if (
      /assistant\s+for\s+a?n?\s+.+/.test(lower) ||
      /industry\s*:/.test(lower) ||
      /business\s*:/.test(lower)
    ) {
      const specialization = cleanTrailingPunctuation(line);
      identityLines.push(`- ${capitalize(specialization)}`);
      routedSummary.push(`specialization→Identity`);
      continue;
    }

    // If user mistakenly wrote "assistant for a dental clinic" under Response Guidelines,
    // this will still be pulled to Identity by the previous rule.

    // If starts with dash, infer target
    if (line.startsWith('-')) {
      const content = line.replace(/^\-\s*/, '').trim();

      // quick heuristics by keyword
      if (/(tone|friendly|formal|concise|emoji|sentence)/i.test(content)) {
        styleLines.push(`- ${content}`);
        routedSummary.push('style bullet');
      } else if (/(ask|clarify|avoid|do not|cite|source|hallucinat)/i.test(content)) {
        guideLines.push(`- ${content}`);
        routedSummary.push('guidelines bullet');
      } else if (/(book|schedule|collect|lead|faq|escalat|purchase|checkout|conversion|call)/i.test(content)) {
        taskLines.push(`- ${content}`);
        routedSummary.push('task bullet');
      } else if (/(error|fallback|fail|retry|handoff|apolog)/i.test(content)) {
        fallbackLines.push(`- ${content}`);
        routedSummary.push('fallback bullet');
      } else if (/(assistant|represent|brand|voice|persona)/i.test(content)) {
        identityLines.push(`- ${content}`);
        routedSummary.push('identity bullet');
      } else {
        // default to Response Guidelines if ambiguous
        guideLines.push(`- ${content}`);
        routedSummary.push('guidelines bullet (default)');
      }

      continue;
    }

    // Otherwise: sentence heuristics
    if (/(tone|write|style|voice)/i.test(lower)) {
      styleLines.push(`- ${line}`);
      routedSummary.push('style sentence');
    } else if (/(faq|booking|schedule|collect|lead|purchase|escalat)/i.test(lower)) {
      taskLines.push(`- ${line}`);
      routedSummary.push('task sentence');
    } else if (/(clarify|ask|do not|avoid|cite|source|summarize|steps)/i.test(lower)) {
      guideLines.push(`- ${line}`);
      routedSummary.push('guidelines sentence');
    } else if (/(error|fallback|tool|endpoint|fail|handoff|apolog)/i.test(lower)) {
      fallbackLines.push(`- ${line}`);
      routedSummary.push('fallback sentence');
    } else {
      identityLines.push(`- ${line}`);
      routedSummary.push('identity sentence (default)');
    }
  }

  // Merge routed lines, de-duplicated
  for (const l of identityLines) pushUnique(working['Identity'], l);
  for (const l of styleLines) pushUnique(working['Style'], l);
  for (const l of guideLines) pushUnique(working['Response Guidelines'], l);
  for (const l of taskLines) pushUnique(working['Task & Goals'], l);
  for (const l of fallbackLines) pushUnique(working['Error Handling / Fallback'], l);

  // 9) Finalize
  const merged = renderSections(working);
  const summary =
    summaryParts.length || routedSummary.length
      ? `Applied: ${[...summaryParts, ...routedSummary].join(' • ')}`
      : 'Updated.';

  return { merged, summary };
}

// -----------------------------
// Internal utilities
// -----------------------------

function parsePromptIntoSections(text: string): Record<string, string[]> {
  const out: Record<string, string[]> = { ...EMPTY_SECTION_BLOCKS };
  if (!text) return out;

  // Split by [Section]
  const regex = /\[([^\]]+)\]\s*([\s\S]*?)(?=\n\[[^\]]+\]|\s*$)/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    const section = normalizeSectionName(m[1]);
    const body = (m[2] || '').trim();
    if (!SECTION_ORDER.includes(section)) continue;

    // Turn paragraphs into bullets if needed
    const bullets = body
      ? sanitizeBullets(
          body
            .split('\n')
            .map(s => s.trim())
            .filter(Boolean)
            .map(s => (s.startsWith('-') ? s : `- ${s}`))
        )
      : [];

    out[section] = bullets;
  }

  // Ensure all expected sections exist
  for (const s of SECTION_ORDER) {
    if (!out[s]) out[s] = [];
  }
  return out;
}

function renderSections(sections: Record<string, string[]>): string {
  const parts: string[] = [];
  for (const s of SECTION_ORDER) {
    const lines = (sections[s] || []).filter(Boolean);
    parts.push(`[${s}]`);
    if (lines.length === 0) {
      parts.push('');
    } else {
      parts.push(lines.join('\n'));
      parts.push(''); // blank line between sections
    }
  }
  return parts.join('\n').trim() + '\n';
}

function normalizeSectionName(name: string): string {
  const n = (name || '').trim().toLowerCase();
  const map: Record<string, string> = {
    'identity': 'Identity',
    'style': 'Style',
    'response guidelines': 'Response Guidelines',
    'task & goals': 'Task & Goals',
    'tasks & goals': 'Task & Goals',
    'task and goals': 'Task & Goals',
    'error handling / fallback': 'Error Handling / Fallback',
    'error handling': 'Error Handling / Fallback',
    'fallback': 'Error Handling / Fallback',
  };
  return map[n] || toTitle(name.trim());
}

function sanitizeBullets(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of lines) {
    const s = raw.replace(/\s+/g, ' ').trim();
    if (!s) continue;
    const bullet = s.startsWith('-') ? s : `- ${s}`;
    if (!seen.has(bullet.toLowerCase())) {
      seen.add(bullet.toLowerCase());
      out.push(bullet);
    }
  }
  return out;
}

function cloneSections(src: Record<string, string[]>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const s of SECTION_ORDER) out[s] = [...(src[s] || [])];
  return out;
}

function pushUnique(arr: string[], bullet: string) {
  const b = bullet.trim();
  if (!b) return;
  if (!arr.some(x => normalize(x) === normalize(b))) arr.push(b);
}

function normalize(s: string) { return s.replace(/\s+/g, ' ').trim().toLowerCase(); }

function toTitle(s: string) {
  return s.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
}
function formatKey(s: string) { return s.trim().replace(/[_\-]+/g, ' '); }
function cleanTrailingPunctuation(s: string) { return s.replace(/[.?!\s]+$/g, ''); }
function capitalize(s: string) {
  const t = s.trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// -----------------------------
// Config extraction
// -----------------------------
type Config = {
  preset?: string;
  industry?: string;
  tone?: string;
  persona?: string;
  tasks?: string[];
  channels?: string[];
  freeformLines: string[];
};

function extractConfig(raw: string): Config {
  // Accept lines like:
  // preset: dentist
  // industry=dentist; tone=friendly; tasks=lead_qualification,booking; channels=voice,chat
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  const cfg: Config = { freeformLines: [] };

  for (const line of lines) {
    // key=value; key=value; ...
    if (/[:=]/.test(line) && !line.startsWith('-')) {
      const pairs = line.split(/[;,\n]+/).map(s => s.trim()).filter(Boolean);
      for (const p of pairs) {
        const [k0, v0] = p.split(/[:=]/).map(s => (s || '').trim());
        const k = (k0 || '').toLowerCase();
        const v = (v0 || '').trim();
        if (!k || !v) continue;
        if (k === 'preset') cfg.preset = v;
        else if (k === 'industry' || k === 'business') cfg.industry = v;
        else if (k === 'tone') cfg.tone = v;
        else if (k === 'persona') cfg.persona = v;
        else if (k === 'tasks') cfg.tasks = v.split(/[|,]/).map(s => s.trim()).filter(Boolean);
        else if (k === 'channels') cfg.channels = v.split(/[|,]/).map(s => s.trim()).filter(Boolean);
        else {
          // Unknown config keys are treated as freeform guidance
          cfg.freeformLines.push(`- ${k0}: ${v0}`);
        }
      }
      continue;
    }

    // "preset: X" on its own
    const m = /^preset\s*[:=]\s*(.+)$/i.exec(line);
    if (m) { cfg.preset = m[1].trim(); continue; }

    // keep as freeform
    cfg.freeformLines.push(line);
  }

  return cfg;
}

// -----------------------------
// Presets
// -----------------------------
type Preset = {
  name: string;
  identity?: string[];
  style?: string[];
  guidelines?: string[];
  tasks?: string[];
  fallback?: string[];
};

function resolvePreset(key: string): Preset | null {
  const k = key.trim().toLowerCase();

  // map aliases
  const alias: Record<string, string> = {
    'dentist': 'dental_clinic',
    'dental': 'dental_clinic',
    'dental clinic': 'dental_clinic',
    'dental practice': 'dental_clinic',
    'dentistry': 'dental_clinic',
  };
  const canon = alias[k] || k;

  switch (canon) {
    case 'dental_clinic':
      return {
        name: 'Dental Clinic',
        identity: [
          'You are a patient-first assistant for a modern dental clinic.',
          'Represent the clinic professionally, focusing on clarity, empathy, and privacy.',
        ],
        style: [
          'Warm, reassuring, concise. Avoid medical jargon unless asked.',
          'Use 2–4 short sentences per turn.',
        ],
        guidelines: [
          'Never give definitive diagnoses; provide general guidance and recommend in-person evaluation if needed.',
          'For cost/insurance, state ranges and suggest confirming exact coverage with the clinic.',
          'When referencing clinical recommendations, mention source types (ADA, peer-reviewed) if available.',
        ],
        tasks: [
          'Qualify patient needs (pain level, duration, urgency).',
          'Offer appointment options and collect: full name, phone/email, preferred time, reason for visit.',
          'Answer FAQs (cleanings, fillings, whitening, Invisalign, emergency visits).',
          'Escalate emergencies: advise calling the clinic or local emergency line as appropriate.',
        ],
        fallback: [
          'If uncertain about medical advice, suggest contacting a licensed dentist at the clinic.',
          'If scheduling API fails, offer to take contact info for a callback.',
        ],
      };
    default:
      return null;
  }
}

function applyPreset(target: Record<string, string[]>, preset: Preset) {
  if (preset.identity?.length) {
    ensureHeader(target['Identity']);
    for (const s of preset.identity) pushUnique(target['Identity'], `- ${s}`);
  }
  if (preset.style?.length) {
    ensureHeader(target['Style']);
    for (const s of preset.style) pushUnique(target['Style'], `- ${s}`);
  }
  if (preset.guidelines?.length) {
    ensureHeader(target['Response Guidelines']);
    for (const s of preset.guidelines) pushUnique(target['Response Guidelines'], `- ${s}`);
  }
  if (preset.tasks?.length) {
    ensureHeader(target['Task & Goals']);
    for (const s of preset.tasks) pushUnique(target['Task & Goals'], `- ${s}`);
  }
  if (preset.fallback?.length) {
    ensureHeader(target['Error Handling / Fallback']);
    for (const s of preset.fallback) pushUnique(target['Error Handling / Fallback'], `- ${s}`);
  }
}

function ensureHeader(_arr: string[]) {
  // currently a no-op; placeholder if you later want to insert a separating header bullet
}
