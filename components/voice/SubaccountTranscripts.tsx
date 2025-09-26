'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Plus, Bot } from 'lucide-react';

/* ---- Tokens (match your VA/Sidebar) ---- */
const CTA       = '#59d9b3';
const CTA_WEAK  = 'rgba(89,217,179,.12)';
const CTA_LINE  = 'rgba(89,217,179,.20)';
const RADIUS    = 10;

type SubAccount = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  agentsCount?: number;
  active?: boolean;
};

export default function SubaccountGrid() {
  const [items, setItems] = useState<SubAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch('/api/subaccounts').catch(() => null as any);
        const j = r?.ok ? await r.json() : [];
        const clean: SubAccount[] = Array.isArray(j) ? j : (Array.isArray(j?.items) ? j.items : []);
        if (!alive) return;
        setItems(clean);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <section className="sub-grid-wrap">
      {/* search row (optional placeholder so spacing matches your screenshots) */}
      <div className="hdr">
        <h2>Subaccounts</h2>
        <div className="grow" />
      </div>

      {/* grid: 3 per row; responsive to 2 then 1. Rectangles -> squares on small screens */}
      <div className="sub-grid">
        {/* Create card */}
        <CreateCard />

        {/* Existing subaccounts */}
        {loading && [0,1,2].map(i => <SkeletonCard key={`sk-${i}`} />)}
        {!loading && items.map(sa => <SA_Card key={sa.id} sa={sa} />)}
      </div>

      <style jsx>{`
        .sub-grid-wrap{
          color: var(--text);
        }
        .hdr{
          display:flex; align-items:center; gap:12px; margin-bottom:14px;
        }
        .hdr h2{
          font-size:18px; font-weight:700;
          background: linear-gradient(90deg, var(--text) 0%, color-mix(in oklab, var(--text) 80%, white 20%) 100%);
          -webkit-background-clip:text; background-clip:text; color:transparent;
        }

        .sub-grid{
          display:grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }

        @media (max-width: 1100px){
          .sub-grid{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 700px){
          .sub-grid{ grid-template-columns: 1fr; }
        }
      `}</style>
    </section>
  );
}

/* ---------- Cards ---------- */

function CardShell({ children, href }: { children: React.ReactNode; href?: string }) {
  const Wrapper: any = href ? Link : 'div';
  const extra = href ? { href, target: '_blank', rel: 'noreferrer' } : {};
  return (
    <Wrapper className="card group" {...extra}>
      {/* green row overlay like dropdowns */}
      <span className="row-overlay" />
      <div className="inner">
        {children}
      </div>

      <style jsx>{`
        .card{
          position:relative;
          background: var(--panel, #0d0f11);
          border: 1px solid var(--border, rgba(255,255,255,.10));
          border-radius: ${RADIUS}px;
          overflow:hidden;
          box-shadow: 0 18px 36px rgba(0,0,0,.18), 0 0 0 1px ${CTA_LINE} inset;
          /* Rectangle by default */
          aspect-ratio: 16 / 10;
          transition: transform .18s var(--ease, cubic-bezier(.22,.61,.36,1));
        }
        /* Small screens -> squares */
        @media (max-width: 700px){
          .card{ aspect-ratio: 1 / 1; }
        }
        .card:hover{ transform: translateY(-2px); }
        .inner{
          display:flex; flex-direction:column; align-items:center; justify-content:center;
          gap: 12px; height: 100%; padding: 18px;
          background:
            radial-gradient(60% 140% at 0% 0%, rgba(89,217,179,.06) 0%, transparent 60%),
            radial-gradient(60% 140% at 100% 0%, rgba(89,217,179,.04) 0%, transparent 60%),
            transparent;
        }

        /* overlay glow like Sidebar.tsx */
        .row-overlay{
          content: '';
          position:absolute; inset:0; border-radius:${RADIUS}px;
          background:${CTA};
          opacity:0; pointer-events:none;
          mix-blend-mode:screen;
          transition: opacity .18s var(--ease);
        }
        .card:hover .row-overlay{ opacity:.16; }
      `}</style>
    </Wrapper>
  );
}

function IconPill({ white = false, children }:{ white?: boolean; children?: React.ReactNode }) {
  return (
    <div className="pill">
      <span className="glow" />
      <span className="glow-outer" />
      <span className="glow-line" />
      <span className="icon">{children}</span>

      <style jsx>{`
        .pill{
          position:relative;
          width:64px; height:64px; border-radius:12px;
          display:grid; place-items:center;
          background: ${CTA_WEAK};
          border: 1px solid ${CTA_LINE};
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.06);
        }
        .icon :global(svg){
          width:28px; height:28px; stroke-width:2.25;
          color: ${white ? '#ffffff' : CTA};
          filter: drop-shadow(0 0 8px rgba(89,217,179,.35));
        }
        .glow{
          position:absolute; inset:-1px; border-radius:12px;
          box-shadow: 0 0 0 0 ${CTA}; opacity:0;
          transition: box-shadow .22s var(--ease), opacity .22s var(--ease);
        }
        .glow-outer{
          position:absolute; inset:-8px; border-radius:16px;
          background: radial-gradient(60% 60% at 50% 50%, ${CTA} 0%, transparent 70%);
          filter: blur(14px); opacity:0;
          transition: opacity .22s var(--ease);
        }
        .glow-line{
          position:absolute; inset:0; border-radius:12px; opacity:0;
          box-shadow: inset 0 0 0 1px ${CTA_LINE};
          transition: opacity .22s var(--ease);
        }
        :global(.card:hover) .pill .glow{ box-shadow: 0 0 0 3px ${CTA}; opacity:.8; }
        :global(.card:hover) .pill .glow-outer{ opacity:.6; }
        :global(.card:hover) .pill .glow-line{ opacity:1; }
      `}</style>
    </div>
  );
}

/* Create Subaccount */
function CreateCard() {
  return (
    <CardShell href="/subaccounts/new">
      <IconPill>
        <Plus />
      </IconPill>
      <div className="txt">
        <div className="t1">Create Subaccount</div>
        <div className="t2">Click to create</div>
      </div>

      <style jsx>{`
        .txt{ text-align:center; }
        .t1{ font-weight:700; font-size:16px; }
        .t2{ font-size:12px; color: var(--text-muted, #9fb4ad); }
      `}</style>
    </CardShell>
  );
}

/* Subaccount Card (opens new tab to workspace) */
function SA_Card({ sa }: { sa: SubAccount }) {
  return (
    <CardShell href={`/subaccounts/${sa.id}`}>
      <IconPill>
        <Bot />
      </IconPill>
      <div className="txt">
        <div className="name">{sa.name}</div>
        <div className="meta">
          <span>{sa.agentsCount ?? 0} AI Agents</span>
          <span className={`dot ${sa.active ? 'on' : 'off'}`} />
          <span>{sa.active ? 'Active' : 'Inactive'}</span>
        </div>
      </div>

      <style jsx>{`
        .txt{ text-align:center; }
        .name{ font-weight:700; font-size:16px; }
        .meta{
          margin-top:6px; font-size:12px; color: var(--text-muted, #9fb4ad);
          display:flex; align-items:center; gap:8px; justify-content:center;
        }
        .dot{
          width:8px; height:8px; border-radius:999px; display:inline-block;
          border:1px solid rgba(0,0,0,.2);
        }
        .dot.on{ background:${CTA}; border-color:${CTA}; box-shadow:0 0 0 3px rgba(89,217,179,.18); }
        .dot.off{ background:rgba(127,127,127,.5); border-color:rgba(127,127,127,.5); }
      `}</style>
    </CardShell>
  );
}

/* Skeleton while loading */
function SkeletonCard() {
  return (
    <div className="sk card">
      <span className="row-overlay" />
      <div className="inner">
        <div className="box" />
        <div className="line" />
        <div className="line small" />
      </div>

      <style jsx>{`
        .sk .inner{ gap:10px; }
        .box{
          width:64px; height:64px; border-radius:12px;
          background: color-mix(in oklab, var(--panel, #0d0f11) 70%, white 30%);
          opacity:.35;
        }
        .line{
          width:60%; height:12px; border-radius:6px;
          background: color-mix(in oklab, var(--panel, #0d0f11) 70%, white 30%);
          opacity:.28;
        }
        .line.small{ width:40%; height:10px; opacity:.22; }
      `}</style>
    </div>
  );
}
