// components/voice/PromptSection.tsx
'use client';

import { useState, useEffect } from 'react';
import { Wand2 } from 'lucide-react';
import DiffMatchPatch from 'diff-match-patch';

const BASE_PROMPT = `[Identity]
You are a versatile and adaptable AI assistant designed to help users achieve their goals by customizing responses and adapting to different contexts.

[Style]
- Maintain a neutral and professional tone.
- Be concise and clear in communication.

[Response Guidelines]
- Provide precise and actionable information.
- Use simple language to ensure understanding by a wide audience.
  
[Task & Goals]
1. Understand the user's request or question.
2. Process the information or perform the requested task using the available tools or default capabilities.
3. Provide an appropriate and accurate response or solution.
4. Adapt responses based on the user's input and context.

[Error Handling / Fallback]
- If the user's input is unclear or incomplete, ask clarifying questions to gather necessary information.
- If an error occurs while processing a request, inform the user politely and suggest alternative actions or ask to try again.
`;

type Props = {
  onChange: (value: string) => void;
};

export default function PromptSection({ onChange }: Props) {
  const [custom, setCustom] = useState('');
  const [display, setDisplay] = useState(BASE_PROMPT);
  const [typing, setTyping] = useState(false);

  // always emit base + custom
  useEffect(() => {
    onChange(BASE_PROMPT + '\n\n' + (custom || ''));
  }, [custom, onChange]);

  async function handleGenerate() {
    // fake "new generated prompt"
    const newPrompt = BASE_PROMPT + '\n\n' + custom + '\n\nAlways greet the user warmly.';
    animateDiff(display, newPrompt);
  }

  function animateDiff(oldText: string, newText: string) {
    const dmp = new DiffMatchPatch();
    const diffs = dmp.diff_main(oldText, newText);
    dmp.diff_cleanupSemantic(diffs);

    let idx = 0;
    let html = '';
    setTyping(true);

    function step() {
      if (idx >= diffs.length) {
        setTyping(false);
        setDisplay(newText);
        return;
      }
      const [op, data] = diffs[idx];
      if (op === 0) {
        html += `<span>${escapeHtml(data)}</span>`;
      } else if (op === 1) {
        html += `<span style="color:#00ffc2;">${escapeHtml(data)}</span>`;
      } else if (op === -1) {
        html += `<span style="color:#ff4d4d;text-decoration:line-through;">${escapeHtml(data)}</span>`;
      }
      idx++;
      setDisplay(html);
      setTimeout(step, 40); // typing speed
    }
    step();
  }

  return (
    <section className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          Prompt
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setCustom('');
              setDisplay(BASE_PROMPT);
            }}
            className="inline-flex items-center gap-2 rounded-[18px] px-3 py-1.5 text-xs font-medium"
            style={{
              background: 'var(--vs-input-bg)',
              border: '1px solid var(--vs-input-border)',
              color: 'var(--text)',
            }}
          >
            Reset
          </button>
          <button
            onClick={handleGenerate}
            disabled={typing}
            className="inline-flex items-center gap-2 rounded-[18px] px-4 py-1.5 text-xs font-semibold text-black"
            style={{
              background: typing ? '#2e6f63' : 'var(--brand)',
              boxShadow: '0 10px 24px rgba(0,255,194,.25)',
            }}
          >
            <Wand2 className="w-4 h-4" /> {typing ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </div>

      {/* Prompt display */}
      <div
        className="rounded-[18px] overflow-hidden p-4 text-sm whitespace-pre-wrap"
        style={{
          background: 'var(--vs-input-bg)',
          border: '1px solid var(--vs-input-border)',
          boxShadow: 'var(--vs-input-shadow)',
          color: 'var(--text)',
          fontFamily: 'monospace',
          minHeight: '240px',
        }}
        dangerouslySetInnerHTML={{ __html: display }}
      />

      {/* Custom textarea */}
      <textarea
        value={custom}
        onChange={(e) => setCustom(e.target.value)}
        placeholder="Add your extra instructions here…"
        className="w-full min-h-[100px] p-3 rounded-[14px] resize-none bg-transparent text-sm outline-none"
        style={{
          background: 'var(--vs-input-bg)',
          border: '1px solid var(--vs-input-border)',
          boxShadow: 'var(--vs-input-shadow)',
          color: 'var(--text)',
        }}
      />
    </section>
  );
}

function escapeHtml(text: string) {
  return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
