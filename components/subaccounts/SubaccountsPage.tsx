'use client';

import { Plus, Bot } from 'lucide-react';

type Sub = { id: string; name: string; agents: number; status: 'active'|'inactive' };

const SAMPLE: Sub[] = [
  { id: '68b7b14b2c8bbab698dd0a1', name: 'Dental Chatbot', agents: 1, status: 'active' },
];

export default function SubaccountsPage() {
  return (
    <div className="px-6 md:px-8 max-w-[1200px] mx-auto">
      {/* top bar placeholder; keep minimal while we nail visuals */}
      <div className="flex items-center justify-between py-6">
        <div className="text-xl font-semibold tracking-[.2px]">Launch & Deploy</div>
        <button className="btn-new">New Subaccount</button>
      </div>

      {/* grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pb-16">
        {/* Create card */}
        <button className="sb-card create group" aria-label="Create subaccount">
          <div className="icon-tile">
            <Plus className="h-14 w-14" />
          </div>
          <div className="mt-4 text-[22px] font-semibold leading-none">Create Subaccount</div>
          <div className="mt-1 text-sm opacity-80">Add new workspace</div>
          <div className="mt-6 text-[13px] opacity-90">Click to create</div>
        </button>

        {/* Example existing subaccount card */}
        {SAMPLE.map((s) => (
          <a key={s.id} className="sb-card group" href="#">
            <div className="icon-tile">
              <Bot className="h-14 w-14" />
            </div>
            <div className="mt-4 text-[22px] font-semibold leading-none">{s.name}</div>
            <div className="mt-1 text-sm opacity-80">
              {s.agents} AI Agents • <span className={s.status === 'active' ? 'text-emerald-400' : 'opacity-70'}>{s.status === 'active' ? 'Active' : 'Paused'}</span>
            </div>
            <div className="mt-3 text-[11px] opacity-70">ID: {s.id}</div>
          </a>
        ))}
      </div>

      {/* === Visuals only: stepped stripes + dashed border + glow === */}
      <style jsx>{`
        :root {
          --acc: #00ffc2;                  /* neon accent */
          --acc-deep: #12a989;            /* deeper green */
          --card-edge: #151a1a;           /* edge tone */
          --card-mid: #0b0f10;            /* center tone */
          --line-a: rgba(255,255,255,0.035);
          --line-b: rgba(255,255,255,0.020);
          --dash: rgba(0,255,194,.22);    /* dashed border base */
          --dash-hover: rgba(0,255,194,.38);
          --ring: rgba(0,255,194,.28);    /* hover glow */
          --ring-strong: rgba(0,255,194,.45);
          --ink: rgba(255,255,255,.92);
          --muted: rgba(255,255,255,.66);
        }

        .btn-new {
          height: 40px;
          padding: 0 14px;
          border-radius: 12px;
          font-weight: 600;
          color: #0a1212;
          background: linear-gradient(180deg, #35e9c8, #19c7a7);
          box-shadow: 0 8px 20px rgba(0,255,194,.18);
          transition: transform .2s ease, box-shadow .2s ease, filter .2s ease;
        }
        .btn-new:hover { transform: translateY(-1px); box-shadow: 0 10px 26px rgba(0,255,194,.26); filter: saturate(1.05); }

        /* Card shell */
        .sb-card {
          position: relative;
          border-radius: 20px;
          padding: 22px;
          color: var(--ink);
          text-align: left;
          overflow: hidden;
          isolation: isolate;
          /* multi-layer background:
             1) subtle center vignette
             2) HORIZONTAL repeating stripes (the 2% step bands you want)
             3) base gradient edge->center->edge
          */
          background:
            radial-gradient(80% 60% at 50% 50%, rgba(0,0,0,0.35), transparent 60%),
            repeating-linear-gradient(
              90deg,
              var(--line-a) 0px,
              var(--line-a) 2px,
              var(--line-b) 2px,
              var(--line-b) 4px
            ),
            linear-gradient(90deg, var(--card-edge), var(--card-mid) 50%, var(--card-edge));
          border: 1px dashed var(--dash);
          box-shadow:
            inset 0 0 22px rgba(0,0,0,.40),
            0 10px 26px rgba(0,0,0,.30);
          transition: transform .28s cubic-bezier(.2,.8,.2,1), box-shadow .28s, border-color .28s, filter .28s;
        }

        /* Slight “selected/hover” lift + glow */
        .sb-card:hover,
        .sb-card:focus-visible {
          transform: translateY(-2px);
          border-color: var(--dash-hover);
          box-shadow:
            inset 0 0 22px rgba(0,0,0,.35),
            0 10px 26px rgba(0,0,0,.28),
            0 0 0 1px var(--ring),
            0 14px 44px rgba(0,255,194,.14);
        }

        /* green inner tile for icon — matches screenshots */
        .icon-tile {
          width: 136px;
          height: 136px;
          border-radius: 20px;
          display: grid;
          place-items: center;
          color: var(--acc-deep);
          background:
            linear-gradient(180deg, rgba(255,255,255,.02), rgba(0,0,0,.12)),
            linear-gradient(90deg, rgba(0,0,0,.22), rgba(0,0,0,.32));
          border: 1px solid rgba(255,255,255,.08);
          box-shadow:
            inset 0 0 22px rgba(0,0,0,.45),
            0 8px 28px rgba(0,0,0,.35),
            0 0 0 1px rgba(0,255,194,.06);
          transition: box-shadow .28s, transform .28s;
        }

        .sb-card:hover .icon-tile {
          box-shadow:
            inset 0 0 18px rgba(0,0,0,.35),
            0 10px 32px rgba(0,0,0,.35),
            0 0 0 1px var(--ring-strong),
            0 0 34px rgba(0,255,194,.18);
          transform: translateY(-1px);
        }

        /* Create variant: slightly more “dashed” feel */
        .sb-card.create {
          border-style: dashed;
          background:
            radial-gradient(80% 60% at 50% 50%, rgba(0,255,194,.06), transparent 60%),
            repeating-linear-gradient(
              90deg,
              rgba(0,255,194,.06) 0px,
              rgba(0,255,194,.06) 2px,
              rgba(0,255,194,.03) 2px,
              rgba(0,255,194,.03) 4px
            ),
            linear-gradient(90deg, var(--card-edge), var(--card-mid) 50%, var(--card-edge));
        }

        /* Typography color balance */
        .sb-card :global(svg) { stroke-width: 2.2; }
        .sb-card .opacity-80 { color: var(--muted); }
        .sb-card .opacity-70 { color: rgba(255,255,255,.6); }
        .sb-card .opacity-90 { color: rgba(255,255,255,.84); }

        /* Responsive tune */
        @media (max-width: 640px) {
          .icon-tile { width: 120px; height: 120px; }
        }
      `}</style>
    </div>
  );
}
