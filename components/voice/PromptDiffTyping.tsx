// FILE: components/voice/PromptDiffTyping.tsx
'use client';

import React, { useMemo } from 'react';

/** LCS-based character diff */
function diffCharsLCS(a: string, b: string) {
  const A = Array.from(a || '');
  const B = Array.from(b || '');
  const n = A.length,
    m = B.length;
  const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = A[i - 1] === B[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const ops: Array<{ t: 'same' | 'add' | 'rem'; ch: string }> = [];
  let i = n,
    j = m;
  while (i > 0 && j > 0) {
    if (A[i - 1] === B[j - 1]) {
      ops.push({ t: 'same', ch: A[i - 1] });
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      ops.push({ t: 'rem', ch: A[i - 1] });
      i--;
    } else {
      ops.push({ t: 'add', ch: B[j - 1] });
      j--;
    }
  }
  while (i > 0) {
    ops.push({ t: 'rem', ch: A[i - 1] });
    i--;
  }
  while (j > 0) {
    ops.push({ t: 'add', ch: B[j - 1] });
    j--;
  }
  ops.reverse();
  return ops;
}

export type PromptDiffTypingProps = {
  base: string;              // original text
  next: string;              // candidate text (progressively typed)
  onAccept: () => void;      // accept candidate -> set into textarea
  onDecline: () => void;     // discard candidate
  minHeight?: number;        // px, default 320
};

export default function PromptDiffTyping({
  base,
  next,
  onAccept,
  onDecline,
  minHeight = 320,
}: PromptDiffTypingProps) {
  const ops = useMemo(() => diffCharsLCS(base, next), [base, next]);

  return (
    <div
      className="rounded-[8px] px-3 py-[10px]"
      style={{
        minHeight,
        background: 'var(--panel-bg)',
        border: '1px solid var(--border-weak)',
        color: 'var(--text)',
      }}
    >
      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '1.55', margin: 0 }}>
        {ops.map((o, i) => {
          if (o.t === 'same') return <span key={i}>{o.ch}</span>;
          if (o.t === 'add')
            return (
              <span key={i} style={{ background: 'rgba(16,185,129,.14)', color: '#10b981' }}>
                {o.ch}
              </span>
            );
          return (
            <span
              key={i}
              style={{ background: 'rgba(239,68,68,.18)', color: '#ef4444', textDecoration: 'line-through' }}
            >
              {o.ch}
            </span>
          );
        })}
      </pre>

      <div className="mt-3 flex gap-2">
        <button
          className="h-9 px-3 rounded-[8px] font-semibold"
          style={{ background: '#10b981', color: '#ffffff' }}
          onClick={onAccept}
        >
          Accept
        </button>
        <button
          className="h-9 px-3 rounded-[8px] font-semibold"
          style={{ background: '#ef4444', color: '#ffffff' }}
          onClick={onDecline}
        >
          Decline
        </button>
      </div>
    </div>
  );
}
