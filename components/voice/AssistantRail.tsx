// components/voice/AssistantRail.tsx
'use client';

import React from 'react';

export default function AssistantRail() {
  return (
    <div
      className="p-4 text-xs rounded-md"
      style={{
        border: '1px solid var(--border)',
        background: 'color-mix(in oklab, var(--bg) 98%, transparent)',
      }}
    >
      <div className="font-medium mb-1">AssistantRail (tijdelijk)</div>
      <p className="opacity-70">
        Heb dit neergezet anders kan ik <code>improve.tsx</code> niet updaten. Code staat in Discord.
      </p>
    </div>
  );
}
