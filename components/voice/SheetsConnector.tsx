'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, ChevronRight, ChevronLeft, Check, Loader2, Link2, PlusCircle, RefreshCcw } from 'lucide-react';

type Spreadsheet = { id: string; name: string };
type Tab = { id: string; name: string };

type Props = {
  open: boolean;
  onClose: () => void;
  // optional: initial selected spreadsheet or tab ids if you reopen
  initialSpreadsheetIds?: string[];
  initialTabIdsBySheet?: Record<string, string[]>;
};

const CTA = '#59d9b3';
const CTA_HOVER = '#54cfa9';

export default function SheetsConnector({
  open,
  onClose,
  initialSpreadsheetIds = [],
  initialTabIdsBySheet = {},
}: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // session
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);

  // step: choose spreadsheets
  const [spreadsheets, setSpreadsheets] = useState<Spreadsheet[]>([]);
  const [selectedSheetIds, setSelectedSheetIds] = useState<string[]>(initialSpreadsheetIds.slice(0, 50));
  const [linkInput, setLinkInput] = useState(''); // optional paste link

  // step: tabs + mapping
  const [tabsBySheet, setTabsBySheet] = useState<Record<string, Tab[]>>({});
  const [selectedTabsBySheet, setSelectedTabsBySheet] = useState<Record<string, string[]>>(
    JSON.parse(JSON.stringify(initialTabIdsBySheet || {}))
  );

  // mapping fields per sheet (we store by sheetId)
  type Mapping = { nameCol: string; phoneCol: string; dateCol: string; timeCol: string; notesCol?: string };
  const [mappingBySheet, setMappingBySheet] = useState<Record<string, Mapping>>({});

  // test & save
  const [testStatus, setTestStatus] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // reset when opened
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setBusy(false);
    setErr('');
    setTestStatus('');
  }, [open]);

  /* ───── ui helpers ───── */
  const Button = (p: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'ghost' | 'solid' | 'outline' }) => {
    const { variant = 'solid', style, ...rest } = p;
    const base: React.CSSProperties = {
      height: 40,
      padding: '0 14px',
      borderRadius: 10,
      fontSize: 14,
      fontWeight: 600,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      border: '1px solid rgba(255,255,255,.12)',
    };
    const styles: Record<string, React.CSSProperties> = {
      solid: { background: CTA, color: '#fff', boxShadow: '0 10px 22px rgba(89,217,179,.20)', borderColor: 'rgba(255,255,255,.10)' },
      outline: { background: 'var(--panel, #0d0f11)', color: 'var(--text, #e6f1ef)' },
      ghost: { background: 'transparent', color: 'var(--text, #e6f1ef)', border: '1px solid rgba(255,255,255,.12)' },
    };
    return (
      <button
        {...rest}
        style={{ ...base, ...styles[variant], ...style }}
        onMouseEnter={(e) => variant === 'solid' && ((e.currentTarget as HTMLButtonElement).style.background = CTA_HOVER)}
        onMouseLeave={(e) => variant === 'solid' && ((e.currentTarget as HTMLButtonElement).style.background = CTA)}
      />
    );
  };

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <div className="text-sm font-semibold mb-2" style={{ color: 'var(--text, #e6f1ef)' }}>
      {children}
    </div>
  );

  const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      {...p}
      className="w-full bg-transparent outline-none text-sm rounded-[10px] px-3 py-2"
      style={{ border: '1px solid var(--input-border, rgba(255,255,255,.14))', color: 'var(--text, #e6f1ef)' }}
    />
  );

  const Select = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => (
    <select
      {...p}
      className="w-full bg-transparent outline-none text-sm rounded-[10px] px-3 py-2"
      style={{ border: '1px solid var(--input-border, rgba(255,255,255,.14))', color: 'var(--text, #e6f1ef)' }}
    />
  );

  /* ───── api helpers (frontend expectations) ───── */
  async function fetchJSON<T = any>(url: string, init?: RequestInit): Promise<T> {
    const r = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
    if (!r.ok) throw new Error((await r.text()) || 'Request failed');
    return r.json();
  }

  // 1) check session
  useEffect(() => {
    if (!open) return;
    (async () => {
      setBusy(true);
      setErr('');
      try {
        const s = await fetchJSON<{ connected: boolean; email?: string }>('/api/connectors/sheets?fn=session');
        setConnectedEmail(s.connected ? s.email || 'demo-user@example.com' : null);
      } catch (e: any) {
        setErr(e.message || 'Could not read session.');
      } finally {
        setBusy(false);
      }
    })();
  }, [open]);

  async function startOAuth() {
    setBusy(true);
    setErr('');
    try {
      const { authUrl } = await fetchJSON<{ authUrl: string }>('/api/connectors/sheets?fn=oauth-url', { method: 'POST' });
      window.location.href = authUrl;
    } catch (e: any) {
      setErr(e.message || 'Could not start Google sign-in.');
      setBusy(false);
    }
  }

  async function loadSpreadsheets() {
    setBusy(true);
    setErr('');
    try {
      const out = await fetchJSON<{ spreadsheets: Spreadsheet[] }>('/api/connectors/sheets?fn=list&limit=50');
      setSpreadsheets(out.spreadsheets || []);
    } catch (e: any) {
      setErr(e.message || 'Could not list spreadsheets.');
    } finally {
      setBusy(false);
    }
  }

  async function loadTabsFor(sheetId: string) {
    if (tabsBySheet[sheetId]) return; // cache
    try {
      const out = await fetchJSON<{ tabs: Tab[] }>(`/api/connectors/sheets?fn=tabs&spreadsheetId=${encodeURIComponent(sheetId)}`);
      setTabsBySheet((m) => ({ ...m, [sheetId]: out.tabs || [] }));
    } catch (e: any) {
      setErr(e.message || 'Could not list tabs.');
    }
  }

  async function saveConfig() {
    setSaving(true);
    setErr('');
    try {
      const payload = {
        spreadsheets: selectedSheetIds.map((sid) => ({
          id: sid,
          tabIds: selectedTabsBySheet[sid] || [],
          mapping: mappingBySheet[sid] || null,
        })),
        link: linkInput || null,
      };
      await fetchJSON('/api/connectors/sheets?fn=save', { method: 'POST', body: JSON.stringify(payload) });
      setTestStatus('Saved ✓');
    } catch (e: any) {
      setErr(e.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function testAppend(sheetId: string) {
    setTestStatus('Testing…');
    setErr('');
    try {
      const mapping = mappingBySheet[sheetId];
      await fetchJSON('/api/connectors/sheets?fn=test-append', {
        method: 'POST',
        body: JSON.stringify({
          sheetId,
          mapping,
          sample: {
            name: 'Test Client',
            phone: '+1 234 567 0000',
            date: '2025-10-10',
            time: '14:30',
            notes: 'Test from UI',
          },
        }),
      });
      setTestStatus('Append OK ✓');
    } catch (e: any) {
      setErr(e.message || 'Test failed.');
      setTestStatus('');
    }
  }

  /* ───── step logic ───── */
  const canNextFrom1 = !!connectedEmail;
  const canNextFrom2 = selectedSheetIds.length > 0;

  function toggleSheet(id: string) {
    setSelectedSheetIds((prev) => {
      const has = prev.includes(id);
      const next = has ? prev.filter((x) => x !== id) : prev.length < 50 ? [...prev, id] : prev;
      // pre-load tabs if newly added
      if (!has) loadTabsFor(id);
      return next;
    });
  }

  function setTabSelected(sheetId: string, tabId: string, checked: boolean) {
    setSelectedTabsBySheet((m) => {
      const current = new Set(m[sheetId] || []);
      checked ? current.add(tabId) : current.delete(tabId);
      return { ...m, [sheetId]: Array.from(current) };
    });
  }

  /* ───── render helpers ───── */
  const StepPills = () => (
    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted, #9fb4ad)' }}>
      <StepPill n={1} active={step === 1}>Sign in</StepPill>
      <ChevronRight className="w-3 h-3 opacity-60" />
      <StepPill n={2} active={step === 2}>Choose spreadsheets</StepPill>
      <ChevronRight className="w-3 h-3 opacity-60" />
      <StepPill n={3} active={step === 3}>Pick tabs &amp; test</StepPill>
    </div>
  );

  function StepPill({ n, active, children }: { n: number; active: boolean; children: React.ReactNode }) {
    return (
      <span
        className="inline-flex items-center gap-2 px-2 py-1 rounded-[8px]"
        style={{
          background: active ? 'rgba(89,217,179,.12)' : 'transparent',
          boxShadow: active ? '0 0 0 1px rgba(89,217,179,.20) inset' : '0 0 0 1px rgba(255,255,255,.10) inset',
        }}
      >
        <span
          className="grid place-items-center w-5 h-5 rounded-full text-[11px]"
          style={{ background: active ? CTA : 'rgba(255,255,255,.14)', color: active ? '#0a0f0d' : '#fff', fontWeight: 700 }}
        >
          {n}
        </span>
        {children}
      </span>
    );
  }

  /* ───── UI ───── */
  if (!open) return null;

  return (
    <>
      {/* overlay */}
      <div
        className="fixed inset-0"
        style={{ zIndex: 100000, background: 'rgba(6,8,10,.62)', backdropFilter: 'blur(6px)' }}
        onClick={() => !busy && onClose()}
      />
      {/* modal */}
      <div className="fixed inset-0 grid place-items-center px-4" style={{ zIndex: 100001 }}>
        <div
          className="w-full max-w-[720px] rounded-[14px] overflow-hidden"
          style={{
            background: 'var(--panel, #0d0f11)',
            border: '1px solid rgba(89,217,179,.20)',
            boxShadow: '0 22px 44px rgba(0,0,0,.28), 0 0 0 1px rgba(255,255,255,.06) inset, 0 0 0 1px rgba(89,217,179,.20)',
            color: 'var(--text, #e6f1ef)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* header */}
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{
              background:
                'linear-gradient(90deg,var(--panel,#0d0f11) 0%,color-mix(in oklab,var(--panel,#0d0f11) 97%, white 3%) 50%,var(--panel,#0d0f11) 100%)',
              borderBottom: '1px solid rgba(89,217,179,.20)',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: 'rgba(89,217,179,.12)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="4" width="18" height="16" rx="2" stroke={CTA} />
                  <rect x="6" y="7" width="12" height="2" fill={CTA} />
                </svg>
              </div>
              <div>
                <div className="font-semibold">Google Sheets</div>
                <StepPills />
              </div>
            </div>
            <button
              aria-label="Close"
              onClick={() => !busy && onClose()}
              className="w-9 h-9 rounded-[8px] grid place-items-center"
              style={{ border: '1px solid rgba(89,217,179,.20)' }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* body */}
          <div className="px-5 py-5 space-y-5">
            {err ? (
              <div
                className="px-3 py-2 rounded-[10px] text-sm"
                style={{ background: 'rgba(239,68,68,.14)', border: '1px solid rgba(239,68,68,.35)', color: '#fff' }}
              >
                {err}
              </div>
            ) : null}

            {/* STEP 1: sign in */}
            {step === 1 && (
              <>
                <p className="text-sm" style={{ color: 'var(--text-muted, #9fb4ad)' }}>
                  Connect your Google account so we can list your spreadsheets and allow the assistant to read/write appointments.
                </p>

                <div className="flex items-center gap-3">
                  <Button onClick={startOAuth} disabled={busy}>
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon />}
                    Sign in with Google
                  </Button>

                  {connectedEmail ? (
                    <span
                      className="text-xs px-2 py-1 rounded-[10px]"
                      style={{ background: 'rgba(89,217,179,.12)', boxShadow: '0 0 0 1px rgba(89,217,179,.20) inset' }}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Check className="w-4 h-4" style={{ color: CTA }} />
                        Connected as {connectedEmail}
                      </span>
                    </span>
                  ) : null}
                </div>
              </>
            )}

            {/* STEP 2: choose spreadsheets */}
            {step === 2 && (
              <>
                <div className="flex items-center justify-between">
                  <SectionTitle>Choose up to 50 spreadsheets</SectionTitle>
                  <Button variant="ghost" onClick={loadSpreadsheets}>
                    <RefreshCcw className="w-4 h-4" /> Refresh
                  </Button>
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  <div className="rounded-[12px] p-3" style={{ border: '1px solid rgba(255,255,255,.10)' }}>
                    <div className="text-xs mb-2" style={{ color: 'var(--text-muted, #9fb4ad)' }}>
                      Your spreadsheets
                    </div>
                    <div className="max-h-60 overflow-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                      {spreadsheets.length === 0 ? (
                        <div className="text-sm opacity-70">No items yet. Click “Refresh”.</div>
                      ) : (
                        spreadsheets.map((s) => {
                          const checked = selectedSheetIds.includes(s.id);
                          return (
                            <label
                              key={s.id}
                              className="flex items-center justify-between gap-3 px-2 py-2 rounded-[10px] cursor-pointer"
                              style={{
                                border: '1px solid rgba(255,255,255,.10)',
                                background: checked ? 'rgba(89,217,179,.10)' : 'transparent',
                              }}
                            >
                              <span className="truncate">{s.name}</span>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleSheet(s.id)}
                                className="accent-[#59d9b3]"
                              />
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="rounded-[12px] p-3" style={{ border: '1px solid rgba(255,255,255,.10)' }}>
                    <div className="text-xs mb-2" style={{ color: 'var(--text-muted, #9fb4ad)' }}>
                      Or paste a Google Sheet link
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="https://docs.google.com/spreadsheets/d/…"
                        value={linkInput}
                        onChange={(e) => setLinkInput(e.target.value)}
                      />
                      <span className="w-10 h-10 rounded-[10px] grid place-items-center" style={{ border: '1px solid rgba(255,255,255,.10)' }}>
                        <Link2 className="w-4 h-4 opacity-80" />
                      </span>
                    </div>
                    <div className="text-xs mt-2" style={{ color: 'var(--text-muted, #9fb4ad)' }}>
                      Make sure the sheet is shared with the connected Google account.
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* STEP 3: tabs + mapping + test */}
            {step === 3 && (
              <>
                {selectedSheetIds.length === 0 ? (
                  <div className="text-sm opacity-80">Select at least one spreadsheet in Step 2.</div>
                ) : (
                  <div className="space-y-5">
                    {selectedSheetIds.map((sid) => {
                      const sheet = spreadsheets.find((s) => s.id === sid) || { id: sid, name: '(from link)' };
                      const tabs = tabsBySheet[sid] || [];
                      useEffect(() => {
                        loadTabsFor(sid);
                      }, [sid]);

                      const selectedTabs = new Set(selectedTabsBySheet[sid] || []);
                      const mapping = mappingBySheet[sid] || { nameCol: '', phoneCol: '', dateCol: '', timeCol: '', notesCol: '' };

                      const setMap = (k: keyof Mapping, v: string) =>
                        setMappingBySheet((m) => ({ ...m, [sid]: { ...(m[sid] || {}), [k]: v } }));

                      return (
                        <div key={sid} className="rounded-[12px] p-3 space-y-3" style={{ border: '1px solid rgba(255,255,255,.10)' }}>
                          <div className="flex items-center justify-between">
                            <div className="font-medium">{sheet.name}</div>
                            <Button variant="outline" onClick={() => testAppend(sid)}>
                              <PlusCircle className="w-4 h-4" /> Test append
                            </Button>
                          </div>

                          <div className="grid md:grid-cols-2 gap-3">
                            <div>
                              <div className="text-xs mb-1" style={{ color: 'var(--text-muted, #9fb4ad)' }}>
                                Tabs to use (sheets)
                              </div>
                              <div className="max-h-40 overflow-auto pr-1 space-y-2">
                                {tabs.length === 0 ? (
                                  <div className="text-sm opacity-70">Loading tabs…</div>
                                ) : (
                                  tabs.map((t) => (
                                    <label
                                      key={t.id}
                                      className="flex items-center justify-between gap-3 px-2 py-2 rounded-[10px] cursor-pointer"
                                      style={{ border: '1px solid rgba(255,255,255,.10)' }}
                                    >
                                      <span className="truncate">{t.name}</span>
                                      <input
                                        type="checkbox"
                                        className="accent-[#59d9b3]"
                                        checked={selectedTabs.has(t.id)}
                                        onChange={(e) => setTabSelected(sid, t.id, e.target.checked)}
                                      />
                                    </label>
                                  ))
                                )}
                              </div>
                            </div>

                            <div>
                              <div className="text-xs mb-1" style={{ color: 'var(--text-muted, #9fb4ad)' }}>
                                Column mapping (how the AI writes appointments)
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <Input placeholder="Name column (e.g., A)" value={mapping.nameCol} onChange={(e) => setMap('nameCol', e.target.value)} />
                                <Input placeholder="Phone column (e.g., B)" value={mapping.phoneCol} onChange={(e) => setMap('phoneCol', e.target.value)} />
                                <Input placeholder="Date column (e.g., C)" value={mapping.dateCol} onChange={(e) => setMap('dateCol', e.target.value)} />
                                <Input placeholder="Time column (e.g., D)" value={mapping.timeCol} onChange={(e) => setMap('timeCol', e.target.value)} />
                                <Input placeholder="Notes column (optional)" value={mapping.notesCol || ''} onChange={(e) => setMap('notesCol', e.target.value)} />
                              </div>
                              <div className="text-xs mt-2" style={{ color: 'var(--text-muted, #9fb4ad)' }}>
                                The assistant will check for conflicts before writing a new row (same date+time).
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  {testStatus ? (
                    <span
                      className="text-xs px-2 py-1 rounded-[8px]"
                      style={{ background: 'rgba(89,217,179,.12)', boxShadow: '0 0 0 1px rgba(89,217,179,.20) inset' }}
                    >
                      {testStatus}
                    </span>
                  ) : null}
                </div>
              </>
            )}
          </div>

          {/* footer */}
          <div className="px-5 pb-5 flex items-center justify-between">
            <div className="text-xs" style={{ color: 'var(--text-muted, #9fb4ad)' }}>
              You can change these later in Integrations.
            </div>

            <div className="flex items-center gap-2">
              {step > 1 && (
                <Button variant="outline" onClick={() => setStep((s) => (s === 3 ? 2 : 1))}>
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </Button>
              )}
              {step < 3 && (
                <Button
                  onClick={() => setStep((s) => (s === 1 ? 2 : 3))}
                  disabled={(step === 1 && !canNextFrom1) || (step === 2 && !canNextFrom2)}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              )}
              {step === 3 && (
                <Button onClick={saveConfig} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Save
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ───── small google icon ───── */
function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.896 32.66 29.428 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.837 1.156 7.938 3.042l5.657-5.657C33.896 6.053 29.428 4 24 4 12.954 4 4 12.954 4 24s8.954 20 20 20 20-8.954 20-20c0-1.341-.138-2.649-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.818C14.311 15.705 18.773 12 24 12c3.059 0 5.837 1.156 7.938 3.042l5.657-5.657C33.896 6.053 29.428 4 24 4c-7.798 0-14.426 4.47-17.694 10.691z" />
      <path fill="#4CAF50" d="M24 44c5.356 0 10.228-2.05 13.93-5.393l-6.433-5.438C29.44 34.503 26.861 35.5 24 35.5c-5.404 0-9.956-3.621-11.588-8.5l-6.56 5.053C9.077 39.39 16.005 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-1.372 3.157-4.166 5.619-7.813 6.57l6.433 5.438C36.678 41.766 44 36 44 24c0-1.341-.138-2.649-.389-3.917z" />
    </svg>
  );
}
