// pages/api/admin/build-support-index.ts
import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const ADMIN_BUILD_TOKEN = process.env.ADMIN_BUILD_TOKEN || ""; // set in env

const EMBED_URL = "https://api.openai.com/v1/embeddings";
const MODEL = "text-embedding-3-large";
const ROOT = process.cwd();
const DOCS_DIR = path.join(ROOT, "docs"); // put small .md files here
const CHUNK_SIZE = 900;
const CHUNK_OVERLAP = 120;

type Vec = number[];
type Entry = { kind: "chunk"; key: string; text: string; vec: Vec; meta: { path: string; range: [number, number] } };

function chunkText(text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const out: { text: string; range: [number, number] }[] = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(text.length, i + size);
    out.push({ text: text.slice(i, end), range: [i, end] });
    i = end - overlap;
    if (i < 0) i = 0;
    if (i >= text.length) break;
  }
  return out;
}

async function embedOne(input: string): Promise<Vec> {
  const r = await fetch(EMBED_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, input }),
  });
  if (!r.ok) throw new Error(await r.text());
  const j = await r.json();
  return j.data[0].embedding as Vec;
}

function walkDocs(dir: string, exts = [".md", ".mdx", ".txt"]) {
  if (!fs.existsSync(dir)) return [];
  const result: string[] = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const s = fs.statSync(p);
    if (s.isDirectory()) result.push(...walkDocs(p, exts));
    else if (exts.includes(path.extname(name).toLowerCase())) result.push(p);
  }
  return result;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const token = (req.query.token as string) || "";
    if (!ADMIN_BUILD_TOKEN || token !== ADMIN_BUILD_TOKEN) {
      return res.status(403).json({ error: "Forbidden (invalid token)" });
    }
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

    const files = walkDocs(DOCS_DIR);
    if (files.length === 0) {
      return res.status(400).json({ error: "No docs found. Create docs/*.md first." });
    }

    const vectors: Entry[] = [];
    for (const full of files) {
      const rel = path.relative(ROOT, full).replace(/\\/g, "/");
      const raw = fs.readFileSync(full, "utf8");
      const chunks = chunkText(raw);
      for (const c of chunks) {
        const vec = await embedOne(c.text);
        vectors.push({
          kind: "chunk",
          key: `${rel}#${c.range[0]}-${c.range[1]}`,
          text: c.text.slice(0, 400), // snippet only (no full file)
          vec,
          meta: { path: rel, range: c.range },
        });
      }
    }

    res.setHeader("Content-Type", "application/json");
    return res.status(200).send(JSON.stringify({ vectors }, null, 2));
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Build failed" });
  }
}
