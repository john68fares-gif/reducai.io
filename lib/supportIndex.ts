// lib/supportIndex.ts
import fs from "fs";
import path from "path";

export type Vec = number[];
type Entry = { kind: "file"|"chunk"; key: string; text: string; vec: Vec; meta?: any };

let cache: { vectors: Entry[] } | null = null;

export function loadIndex() {
  if (cache) return cache;
  const p = path.join(process.cwd(), "data", "support_index.json");
  const raw = fs.readFileSync(p, "utf8");
  cache = JSON.parse(raw);
  return cache!;
}

export function cosine(a: Vec, b: Vec) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
}
