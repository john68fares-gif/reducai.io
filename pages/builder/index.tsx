import { useRouter } from 'next/router'
import { useSession } from 'next-auth/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import OnboardingOverlay from '../../components/ui/OnboardingOverlay'
import { readText } from '../../lib/userStorage'

export default function BuilderPage() {
  const router = useRouter()
  const { data: session, status } = useSession()

  const userId = useMemo(() => (session?.user as any)?.id || '', [session])
  const mode = (router.query.mode as 'signup'|'signin') || 'signup'
  const onboard = router.query.onboard === '1'

  const [open, setOpen] = useState(false)

  // Gate if not signed in
  useEffect(() => { if (status === 'unauthenticated') router.replace('/login') }, [status, router])

  // Decide if we should show the overlay (per-user)
  useEffect(() => {
    if (status !== 'authenticated' || !userId) return
    const completed = readText(userId, 'profile:completed') === '1'
    if (onboard || (!completed && mode === 'signup')) setOpen(true)
  }, [status, userId, onboard, mode])

  function handleDone() {
    setOpen(false)
    const q = { ...router.query }; delete q.onboard; delete q.mode
    router.replace({ pathname: router.pathname, query: q }, undefined, { shallow: true })
  }

  return (
    <>
      {/* === Your existing "Create a Build" Step 1 area === */}
      <section style={{ color:'#fff', position:'relative', minHeight: 360 }}>
        <h1 className="text-2xl font-bold">Builder</h1>
        <p className="text-white/70 text-sm">Start building your agent.</p>
        {/* ...your step 1 UI... */}
      </section>

      {/* The welcome overlay sits above the Builder */}
      <OnboardingOverlay open={open} mode={mode} userId={userId} onDone={handleDone} />
    </>
  )
}
