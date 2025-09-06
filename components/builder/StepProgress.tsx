'use client';

import dynamic from 'next/dynamic';
import React from 'react';

const Bot3D = dynamic(() => import('./Bot3D.client'), { ssr: false });

function DotDivider() {
  return (
    <div
      className="flex-1 mx-2 h-px rounded-full"
      style={{ background: 'linear-gradient(90deg, transparent, rgba(106,247,209,0.25), transparent)' }}
    />
  );
}

function Stage({
  active,
  label,
  stage,
}: {
  active: boolean;
  label: string;
  stage: 1 | 2 | 3 | 4;
}) {
  // Gray palette (not black)
  const ap = {
    accent: '#6af7d1',
    shellColor: '#3a4044',
    bodyColor:  '#485155',
    trimColor:  '#5e7377',
    faceColor:  '#242b2e',
  };

  const withBody = stage >= 2;
  const arms = stage >= 3 ? 'segment' : 'none';
  const legs = stage >= 4 ? 'segment' : 'none';

  return (
    <div className="flex items-center gap-3 min-w-0">
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center"
        style={{
          background: active ? 'rgba(0,255,194,0.15)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${active ? 'rgba(0,255,194,0.38)' : 'rgba(255,255,255,0.10)'}`,
          boxShadow: active ? '0 0 16px rgba(0,255,194,0.25)' : undefined,
        }}
      >
        {/* @ts-ignore */}
        <Bot3D
          className="w-8 h-8"
          accent={ap.accent}
          shellColor={ap.shellColor}
          bodyColor={ap.bodyColor}
          trimColor={ap.trimColor}
          faceColor={ap.faceColor}
          head="round"
          torso="capsule"
          eyes="dots"
          antenna
          withBody={withBody}
          arms={arms}
          legs={legs}
          idle={false}
        />
      </div>
      <div className={`text-xs truncate ${active ? 'text-white' : 'text-white/70'}`}>{label}</div>
    </div>
  );
}

export default function StepProgress({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <div
      className="w-full mb-7 rounded-[28px] px-4 py-3 flex items-center"
      style={{
        background: 'rgba(13,15,17,0.92)',
        border: '1px solid rgba(106,247,209,0.32)',
        boxShadow: 'inset 0 0 22px rgba(0,0,0,0.28), 0 0 18px rgba(106,247,209,0.06)',
      }}
    >
      <Stage active={current === 1} label="AI Type & Basics" stage={1} />
      <DotDivider />
      <Stage active={current === 2} label="Model Settings" stage={2} />
      <DotDivider />
      <Stage active={current === 3} label="Personality & Knowledge" stage={3} />
      <DotDivider />
      <Stage active={current === 4} label="Final Review" stage={4} />

      <div
        className="ml-auto text-white/75 text-xs rounded-xl px-2 py-1 border"
        style={{ borderColor: 'rgba(255,255,255,0.16)', background: 'rgba(255,255,255,0.05)' }}
      >
        {current} / 4
      </div>
    </div>
  );
}
