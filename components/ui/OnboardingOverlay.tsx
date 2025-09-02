import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'

const CARD: React.CSSProperties = {
  width: '100%',
  maxWidth: 640,
  borderRadius: 20,
  background: 'rgba(13,15,17,.96)',
  border: '1px solid rgba(106,247,209,.28)',
  boxShadow: '0 0 28px rgba(106,247,209,.10), inset 0 0 22px rgba(0,0,0,.28)',
}

const OPTIONS = [
  'YouTube','TikTok','Instagram','Twitter/X','Reddit','Google Search',
  'Friend/Referral','BuildMyAgent community','Other'
]

type Props = {
  open: boolean
  mode: 'signup' | 'signin'
  onDone: () => void
}

export default function OnboardingOverlay({ open, mode, onDone }: Props) {
  const [step, setStep] = useState(0)
  const [fullName, setFullName] = useState('')
  const [heardFrom, setHeardFrom] = useState(OPTIONS[0])
  const steps = useMemo(() => (mode === 'signup' ? 2 : 0), [mode])
  const pct = steps ? Math.round(((step + 1) / steps) * 100) : 100

  useEffect(() => {
    if (!open) setStep(0)
  }, [open])

  async function submit() {
    // save locally
    try {
      localStorage.setItem('profile:completed', '1')
      localStorage.setItem('profile:data', JSON.stringify({ fullName, heardFrom }))
    } catch {}

    // send to Sheets (server will no-op if not configured)
    try {
      await fetch('/api/track/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, heardFrom }),
      })
    } catch {}
    onDone()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: .2 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(2px)'
          }}
        >
          <div className="min-h-screen w-full grid place-items-center p-6">
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
              transition={{ duration: .28 }}
              style={CARD}
              className="p-6"
            >
              {/* Header / Progress */}
              <div className="flex items-center justify-between">
                <div className="font-extrabold text-lg flex items-center gap-2">
                  <span style={{ width:10, height:10, borderRadius:999, background:'#6af7d1', boxShadow:'0 0 16px #6af7d1' }} />
                  reduc.ai
                </div>
                {steps > 0 && (
                  <div className="text-sm text-white/70">{pct}%</div>
                )}
              </div>
              {steps > 0 && (
                <div className="mt-3 w-full h-1.5 bg-white/10 rounded">
                  <div className="h-full rounded" style={{ width: `${pct}%`, background:'#6af7d1' }} />
                </div>
              )}

              {/* Body (steps) */}
              {mode === 'signin' ? (
                <div className="mt-6">
                  <h2 className="text-2xl font-bold">Welcome back</h2>
                  <p className="text-white/70 mt-1">You’re in. Continue where you left off.</p>
                  <div className="mt-5">
                    <button onClick={onDone}
                      className="h-11 px-5 rounded-xl font-semibold"
                      style={{ background:'#00ffc2', color:'#001018' }}>
                      Continue
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-6">
                  {step === 0 && (
                    <>
                      <h2 className="text-2xl font-bold">What’s your name?</h2>
                      <p className="text-white/70 mt-1">We’ll personalize your experience.</p>
                      <input
                        value={fullName}
                        onChange={(e)=>setFullName(e.target.value)}
                        placeholder="Full name"
                        className="mt-4 w-full h-11 rounded-xl bg-black/30 border border-white/20 px-3 outline-none focus:border-[#6af7d1]"
                      />
                      <div className="mt-5 flex justify-end gap-3">
                        <button
                          disabled={!fullName.trim()}
                          onClick={()=>setStep(1)}
                          className="h-11 px-5 rounded-xl font-semibold disabled:opacity-50"
                          style={{ background:'#00ffc2', color:'#001018' }}>
                          Next →
                        </button>
                      </div>
                    </>
                  )}

                  {step === 1 && (
                    <>
                      <h2 className="text-2xl font-bold">Where did you hear about us?</h2>
                      <p className="text-white/70 mt-1">Thanks for the signal.</p>
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {OPTIONS.map(op => (
                          <button
                            key={op}
                            onClick={()=>setHeardFrom(op)}
                            className="h-11 rounded-xl border text-left px-3"
                            style={{
                              borderColor: heardFrom===op ? '#6af7d1' : 'rgba(255,255,255,.18)',
                              background: heardFrom===op ? 'rgba(106,247,209,.12)' : 'rgba(0,0,0,.2)'
                            }}
                          >
                            {op}
                          </button>
                        ))}
                      </div>
                      <div className="mt-5 flex justify-between">
                        <button onClick={()=>setStep(0)} className="h-11 px-4 rounded-xl border border-white/20 bg-black/20">
                          ← Back
                        </button>
                        <button onClick={submit} className="h-11 px-5 rounded-xl font-semibold" style={{ background:'#00ffc2', color:'#001018' }}>
                          Finish
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
