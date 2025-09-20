// lib/prompt-engine.integration.ts
/**
 * Integration helpers + self-test for the prompt engine.
 *
 * Usage:
 *  - Add this file to lib/
 *  - Run with ts-node (or import into your existing tests):
 *      npx ts-node --transpile-only lib/prompt-engine.integration.ts
 *
 * This file assumes lib/prompt-engine.ts is present and exports the functions:
 *   - assemblePromptFromPreset
 *   - applyInstructions
 *   - generateFromFreeText
 *   - computeDiff
 *   - normalizeFullPrompt
 *   - looksLikeFullPrompt
 *
 * The self-test prints concise merged prompt previews and summaries for inspection.
 */

import fs from 'fs';
import path from 'path';
import {
  assemblePromptFromPreset,
  applyInstructions,
  generateFromFreeText,
  computeDiff,
  looksLikeFullPrompt,
  normalizeFullPrompt,
} from './prompt-engine';

// --- Types --- //
type PresetParams = {
  industry: string;
  brand?: string;
  inLocation?: string;
  tone?: string;
  services?: string[];
  booking?: { type: string; url?: string; phone?: string; hours?: string } | null;
};

// --- Frontend-friendly wrappers --- //

/**
 * Build a full system prompt from a preset-ish input.
 * This is the function your frontend can call when user picks a preset or fills form fields.
 */
export function buildPresetPrompt(p: PresetParams & { basePrompt?: string }) {
  const prompt = assemblePromptFromPreset({
    industry: p.industry,
    brand: p.brand,
    inLocation: p.inLocation,
    tone: p.tone,
    services: p.services || [],
    booking: p.booking || null,
    basePrompt: p.basePrompt || '',
  });
  return prompt;
}

/**
 * Apply a user's free-text instructions to an existing base prompt and get the merged prompt + summary.
 */
export function applyUserInstructions(basePrompt: string, userText: string) {
  // If user pasted an entire prompt, normalize it
  if (looksLikeFullPrompt(userText)) {
    return {
      merged: normalizeFullPrompt(userText),
      summary: 'Replaced with normalized full prompt (user pasted).',
      diff: computeDiff(basePrompt, normalizeFullPrompt(userText)),
    };
  }

  // Otherwise apply instructions (merge + bucketize)
  const out = applyInstructions(basePrompt, userText);
  return out;
}

/* ---------------- Self-test scenarios ---------------- */

const EXAMPLES: Array<{ name: string; params: PresetParams; instructions?: string }> = [
  {
    name: 'Dental Clinic - small city',
    params: {
      industry: 'dental',
      brand: 'BrightSmile Dental',
      inLocation: 'Utrecht',
      tone: 'friendly',
      services: ['cleaning', 'fillings', 'whitening', 'emergency'],
      booking: { type: 'online', url: 'https://brightsmile.example/booking', phone: '+31 20 123 4567', hours: 'Mon-Fri 9-17' },
    },
    instructions: `Make responses short and reassuring.
Ask for appointment details: preferred date, patient age, any pain.
If emergency, escalate to call number immediately.`,
  },
  {
    name: 'Neighborhood Restaurant',
    params: {
      industry: 'restaurant',
      brand: 'Casa Verde',
      inLocation: 'Amsterdam',
      tone: 'warm',
      services: ['dine-in', 'takeaway', 'vegan options'],
      booking: { type: 'phone', phone: '+31 6 9876 5432', hours: 'Daily 12-22' },
    },
    instructions: `Use friendly tone. Offer menu highlights and vegan options first.
When asked about booking, always confirm date, party size, and allergies.`,
  },
  {
    name: 'SaaS - HR onboarding tool',
    params: {
      industry: 'saas',
      brand: 'Onboardly',
      inLocation: '',
      tone: 'professional',
      services: ['user setup', 'integration', 'reporting'],
      booking: null,
    },
    instructions: `Be concise and provide step-by-step troubleshooting.
When user is an admin, provide links to documentation and example CLI commands.`,
  },
  {
    name: 'Gym / Fitness Studio',
    params: {
      industry: 'gym',
      brand: 'PeakFit',
      inLocation: 'Rotterdam',
      tone: 'motivational',
      services: ['personal training', 'group classes', 'nutrition coaching'],
      booking: { type: 'online', url: 'https://peakfit.example/book' },
    },
    instructions: `Motivate the user, recommend classes based on goals (strength/endurance/flexibility).
If user asks availability, offer upcoming class times and booking link.`,
  },
];

/* A helper to print a short preview and summary */
function printPreview(title: string, prompt: string, summary?: string) {
  console.log('='.repeat(80));
  console.log(title);
  console.log('-'.repeat(80));
  // Show first ~20 lines so it's quick
  const lines = prompt.split('\n');
  const preview = lines.slice(0, 20).join('\n');
  console.log(preview);
  if (lines.length > 20) console.log('... (truncated)');
  if (summary) console.log('\nSummary:', summary);
  console.log('='.repeat(80) + '\n\n');
}

/**
 * Run a self-test: assemble prompts for examples, apply instructions, show diffs.
 */
export function runSelfTest() {
  console.log(`Running prompt engine self-test: ${EXAMPLES.length} scenarios\n`);

  for (const ex of EXAMPLES) {
    const base = buildPresetPrompt({ ...ex.params, basePrompt: '' });
    printPreview(`[BASE] ${ex.name}`, base);

    if (ex.instructions) {
      console.log(`[APPLY] Applying user instructions for "${ex.name}"...\n`);
      const out = applyUserInstructions(base, ex.instructions);

      printPreview(`[MERGED] ${ex.name}`, out.merged || out.merged, out.summary || (out as any).summary);

      // Show small diff summary
      const diff = (out as any).diff || computeDiff(base, out.merged);
      const added = diff.filter((d: any) => d.t === 'add').length;
      const removed = diff.filter((d: any) => d.t === 'rem').length;
      console.log(`Diff: +${added} / -${removed} lines\n`);
    }
  }

  console.log('Self-test complete.\n');
}

/* ---------------- Batch generator for many variants ---------------- */

/**
 * Batch-generate many prompt variants by varying tone, services, locations, brands.
 * Useful to generate bulk presets for QA (e.g., 1000 variations) — careful: large outputs.
 */
export function batchGenerateVariants(opts: {
  industries: string[];
  brands?: string[];
  locations?: string[];
  tones?: string[];
  servicePool?: string[]; // pick subsets
  maxVariants?: number;
}) {
  const {
    industries,
    brands = ['Acme Co', 'Local Business', 'Corner Shop'],
    locations = ['Amsterdam', 'Utrecht', 'Rotterdam', 'Eindhoven'],
    tones = ['friendly', 'professional', 'warm', 'casual'],
    servicePool = ['serviceA', 'serviceB', 'serviceC', 'serviceD', 'serviceE'],
    maxVariants = 200,
  } = opts;

  const results: { key: string; prompt: string }[] = [];
  let count = 0;

  outer: for (const industry of industries) {
    for (const brand of brands) {
      for (const tone of tones) {
        for (const loc of locations) {
          // construct a services subset deterministically
          const services = servicePool.slice(0, (brand.length % servicePool.length) + 1);
          const p = assemblePromptFromPreset({
            industry,
            brand,
            inLocation: loc,
            tone,
            services,
            booking: null,
          });
          results.push({ key: `${industry}|${brand}|${tone}|${loc}`, prompt: p });
          count++;
          if (count >= maxVariants) break outer;
        }
      }
    }
  }

  return results;
}

/* ---------------- If run directly, execute self-test ---------------- */
if (require.main === module) {
  // run the self test and optionally create a small file with outputs
  runSelfTest();

  try {
    const sampleBatch = batchGenerateVariants({
      industries: ['dental', 'restaurant', 'saas', 'gym', 'retail'],
      maxVariants: 40,
    });

    const outPath = path.join(process.cwd(), 'tmp-prompt-sample.json');
    fs.writeFileSync(outPath, JSON.stringify(sampleBatch.slice(0, 20).map(r => ({ key: r.key, preview: r.prompt.split('\n').slice(0, 20).join('\n') })), null, 2), 'utf-8');
    console.log(`Wrote sample prompt previews to ${outPath}`);
  } catch (err) {
    console.warn('Could not write sample file (ok in some environments).', err);
  }
}

export default {
  buildPresetPrompt,
  applyUserInstructions,
  runSelfTest,
  batchGenerateVariants,
};
