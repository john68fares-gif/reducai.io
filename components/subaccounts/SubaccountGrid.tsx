// FILE: components/subaccounts/SubaccountGrid.tsx
'use client';

import React from 'react';
import { Plus, Bot } from 'lucide-react';
import type { Subaccount } from './SubaccountsPage';

const CTA       = '#59d9b3';
const CTA_LINE  = 'rgba(89,217,179,.20)';
const CTA_WEAK  = 'rgba(89,217,179,.12)';

export default function SubaccountGrid({
  items,
  onCreateClick,
  onOpen,
}:{
  items: Subaccount[];
  onCreateClick: ()=>void;
  onOpen: (id:string)=>void;
}) {
  return (
    <div className="sa-grid">
      {/* Create tile */}
      <button className="tile create group" onClick={onCreateClick} aria-label="Create subaccount">
        <div className="tile-head">Create Subaccount</div>
        <div className="tile-core">
          <div className="icon-pill">
            <Plus className="w-8 h-8" />
          </div>
          <div className="tile-sub">Click to create</div>
        </div>
      </button>

      {/* Subaccount tiles */}
      {items.map(item => (
        <button
          key={item.id}
          data-sub-id={item.id}
          className="tile item group"
          onClick={()=>onOpen(item.id)}
          title={item.name}
        >
          <div className="tile-head">{item.name}</div>
          <div className="tile-core">
            <div className="icon-pill">
              <Bot className="w-8 h-8" />
            </div>
            <div className="tile-meta">
              <span className="mono">ID: {item.id.slice(0, 12)}…</span>
              <span className="dot" style={{ background:item.status==='Active' ? '#22c55e' : '#f59e0b' }} />
              <span>{item.status}</span>
              <span>•</span>
              <span>{item.agents} AI Agents</span>
            </div>
          </div>
        </button>
      ))}

      <style jsx>{`
        .sa-grid{
          display:grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap:18px;
        }
        @media (max-width: 1100px){
          .sa-grid{ grid-template-columns: repeat(2, minmax(0,1fr)); }
        }
        @media (max-width: 640px){
          .sa-grid{ grid-template-columns: 1fr; }
        }

        .tile{
          position:relative;
          background: var(--panel, #0d0f11);
          color: var(--text, #e6f1ef);
          border: 1px solid ${CTA_LINE};
          border-radius:12px;
          box-shadow: 0 14px 28px rgba(0,0,0,.20), 0 0 0 1px rgba(255,255,255,.06) inset;
          text-align:left;
          padding:16px 16px 18px;
          min-height: 200px;               /* rectangle on desktop */
          transition: transform .18s ease, box-shadow .18s ease;
          overflow:hidden;
        }
        @media (max-width: 640px){
          .tile{ min-height: 140px; }      /* gets closer to square on small */
        }
        .tile::after{
          content:'';
          position:absolute; inset:0;
          border-radius:12px;
          background:${CTA};
          opacity:0; mix-blend-mode:screen; pointer-events:none;
          transition:opacity .18s ease;
        }
        .tile:hover{ transform: translateY(-2px); }
        .tile:hover::after{ opacity:.16; }

        .tile-head{
          font-weight:700; font-size:15px; letter-spacing:.2px;
          margin-bottom:10px; color:var(--text);
        }
        .tile-core{
          display:grid; place-items:center; gap:10px;
          height: calc(100% - 34px);
          border-radius:10px;
          background: radial-gradient(120% 120% at 50% 0%, ${CTA_WEAK} 0%, transparent 48%);
          border: 1px solid ${CTA_LINE};
        }
        .tile.create .tile-core{
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.06);
        }
        .icon-pill{
          width:94px; height:94px; border-radius:12px;
          display:grid; place-items:center;
          background: rgba(255,255,255,.06);
          border: 1px solid ${CTA_LINE};
          box-shadow: 0 10px 22px rgba(89,217,179,.18);
        }
        .icon-pill :global(svg){ color:${CTA}; }

        .tile-sub{
          font-size:12px; color:var(--text-muted,#9fb4ad);
        }

        .tile-meta{
          margin-top:6px;
          display:flex; gap:8px; align-items:center; flex-wrap:wrap;
          font-size:12px; color:var(--text-muted,#9fb4ad);
        }
        .mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
        .dot{ width:8px; height:8px; border-radius:999px; display:inline-block; }
      `}</style>
    </div>
  );
}
