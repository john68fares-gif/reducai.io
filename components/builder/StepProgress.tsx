// components/builder/StepProgress.tsx
'use client';

import dynamic from 'next/dynamic';
import React from 'react';

const Bot3D = dynamic(() => import('./Bot3D.client'), { ssr: false });

type StageNum = 1 | 2 | 3 | 4;

function Divider() {
  return (
    <div
      className="flex-1 mx-2 h-px rounded-full"
      style={{ background: 'linear-gradient(90deg, transparent, var(--brand-weak), transparent)' }}
    />
  );
}

function Stage({
  active,
  label,
  stage,
  dim,
}: {
  active: boolean;
  label: string;
  stage: StageNum;
  dim?: boolean; // used in loading skeleton
}) {
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
          background: active ? 'rgba(0,255,194,0.15)' : 'var(--card)',
          border: `1px solid ${active ? 'rgba(0,255,194,0.38)' : 'var(--border)'}`,
          boxShadow: active ? '0 0 16px rgba(0,255,194,0.25), var(--shadow-card)' : 'var(--shadow-card)',
          filter: dim ? 'opacity(.55)' : undefined,
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
      <div
        className="text-xs truncate"
        style={{ color: active ? 'var(--text)' : 'var(--text-muted)', filter: dim ? 'opacity(.55)' : undefined }}
      >
        {label}
      </div>
    </div>
  );
}

/**
 * StepProgress
 * - light/dark via CSS vars
 * - short labels
 * - optional loading skeleton (show while data booting)
 */
export default function StepProgress({
  current,
  loading = false,
  labels = ['AI Type', 'Model', 'Prompt', 'Overview'],
}: {
  current: StageNum;
  loading?: boolean;
  labels?: [string, string, string, string] | string[];
}) {
  const L = labels as string[];

  return (
    <div
      className="w-full mb-7 rounded-[28px] px-4 py-3 flex items-center"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {loading ? (
        <>
          <Stage active={false} label={L[0]} stage={1} dim />
          <Divider />
          <Stage active={false} label={L[1]} stage={2} dim />
          <Divider />
          <Stage active={false} label={L[2]} stage={3} dim />
          <Divider />
          <Stage active={false} label={L[3]} stage={4} dim />
          <div className="ml-auto text-xs rounded-xl px-2 py-1 border skeleton-chip" />
        </>
      ) : (
        <>
          <Stage active={current === 1} label={L[0]} stage={1} />
          <Divider />
          <Stage active={current === 2} label={L[1]} stage={2} />
          <Divider />
          <Stage active={current === 3} label={L[2]} stage={3} />
          <Divider />
          <Stage active={current === 4} label={L[3]} stage={4} />
          <div
            className="ml-auto text-xs rounded-xl px-2 py-1 border"
            style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text-muted)' }}
          >
            {current} / 4
          </div>
        </>
      )}
    </div>
  );
}
