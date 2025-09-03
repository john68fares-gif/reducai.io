// lib/supportIndex.ts
import fs from "fs";
import path from "path";

export type Vec = number[];
export type Entry = {
  kind: "file" | "chunk";
  key: string;
  text: string;
  vec: Vec;
  meta?: { path?: string; range?: [number, number]; [k: string]: any };
};

type IndexData = { vectors: Entry[] };

let cache: IndexData | null = null;

export function loadIndex(): IndexData {
  if (cache) return cache;

  const p = path.join(process.cwd(), "data", "support_index.json");
  try {
    const raw = fs.readFileSync(p, "utf8");
    cache = JSON.parse(raw) as IndexData;

    // basic shape guard
    if (!cache || !Array.isArray(cache.vectors)) {
      throw new Error("support_index.json malformed");
    }
    return cache;
  } catch (err) {
    // Fallback so the site still works even if the file is missing/bad
    cache = {
      vectors: [
        {
          kind: "chunk",
          key: "docs/build/overview.md#fallback",
          text:
            "Builder overview: Step 1 choose AI type; Step 2 fill Agent Name/Business Niche/Chat Language and pick Model/Temperature/API Key; Step 3 edit prompt sections; Step 4 Review → Generate Agent → Dashboard.",
          vec: [], // placeholder; safe with cosine() below
          meta: { path: "docs/build/overview.md", range: [1, 200] }
        }
      ]
    };
    return cache;
  }
}

/**
 * Cosine similarity that is dimension-agnostic and safe with empty vectors.
 * Works even if one/both vectors are shorter or placeholders (e.g., []).
 */
export function cosine(a: Vec, b: Vec): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a?.length || 0, b?.length || 0);

  for (let i = 0; i < n; i++) {
    const ai = a[i] || 0;
    const bi = b[i] || 0;
    dot += ai * bi;
    na += ai * ai;
    nb += bi * bi;
  }

  const denom = Math.sqrt(na) * Math.sqrt(nb);
  if (!isFinite(denom) || denom === 0) return 0; // safe for empty/zero vectors
  return dot / denom + 1e-8; // tiny epsilon to avoid 0/0 edge noise
}
