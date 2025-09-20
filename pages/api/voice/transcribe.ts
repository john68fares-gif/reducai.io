// pages/api/voice/transcribe.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

// Next.js bodyParser off for formidable
export const config = { api: { bodyParser: false } };

type TranscribeOpts = {
  provider?: 'deepgram' | 'whisper';
  model?: string;
  language?: string;
  numerals?: 'true' | 'false';
  denoise?: 'true' | 'false';
};

async function parseForm(req: NextApiRequest) {
  const form = formidable({ multiples: false, keepExtensions: true });
  return new Promise<{ fields: formidable.Fields; files: formidable.Files }>((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { fields, files } = await parseForm(req);

    const provider = String(fields.provider || 'deepgram') as TranscribeOpts['provider'];
    const model = String(fields.model || (provider === 'deepgram' ? 'nova-2' : 'whisper-1'));
    const language = fields.language ? String(fields.language) : undefined;
    const numerals = String(fields.numerals || 'false') === 'true';
    const denoise = String(fields.denoise || 'false') === 'true';

    const audioFile: any = (files as any).audio;
    if (!audioFile) return res.status(400).json({ error: 'Missing audio file' });

    const filePath = audioFile.filepath || audioFile.path;
    const fileName = audioFile.originalFilename || path.basename(filePath);
    const fileType = audioFile.mimetype || 'audio/webm';

    let text = '';

    if (provider === 'deepgram') {
      const DG_KEY = process.env.DEEPGRAM_API_KEY;
      if (!DG_KEY) return res.status(401).json({ error: 'DEEPGRAM_API_KEY missing' });

      const params = new URLSearchParams();
      params.set('model', model.toLowerCase().replace(/\s+/g, '-')); // "Nova 2" -> "nova-2"
      if (language) params.set('language', language);
      if (numerals) params.set('numerals', 'true');
      if (denoise) params.set('diarize', 'false'); // example toggle; you can map denoise differently

      const url = `https://api.deepgram.com/v1/listen?${params.toString()}`;
      const buf = fs.readFileSync(filePath);

      const dgRes = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${DG_KEY}`,
          'Content-Type': fileType
        },
        body: buf
      });

      if (!dgRes.ok) {
        const errText = await dgRes.text().catch(()=> 'DG error');
        return res.status(502).json({ error: 'Deepgram error', detail: errText });
      }
      const dgJson: any = await dgRes.json();
      text =
        dgJson?.results?.channels?.[0]?.alternatives?.[0]?.transcript ||
        dgJson?.results?.alternatives?.[0]?.transcript ||
        '';
    } else {
      // OpenAI Whisper
      const OPENAI_KEY = process.env.OPENAI_API_KEY;
      if (!OPENAI_KEY) return res.status(401).json({ error: 'OPENAI_API_KEY missing' });

      const form = new FormData();
      const fileBlob = new Blob([fs.readFileSync(filePath)], { type: fileType });
      form.append('file', fileBlob, fileName);
      form.append('model', model || 'whisper-1');
      if (language) form.append('language', language);

      const oaRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${OPENAI_KEY}` },
        body: form as any
      });

      if (!oaRes.ok) {
        const errText = await oaRes.text().catch(()=> 'OpenAI error');
        return res.status(502).json({ error: 'OpenAI Whisper error', detail: errText });
      }
      const oaJson: any = await oaRes.json();
      text = oaJson?.text || '';
    }

    return res.status(200).json({ text });
  } catch (e: any) {
    console.error('transcribe error', e);
    return res.status(500).json({ error: 'Server error', detail: String(e?.message || e) });
  }
}
