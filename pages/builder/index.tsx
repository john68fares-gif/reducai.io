import { useRouter } from 'next/router'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import OnboardingOverlay from '../../components/ui/OnboardingOverlay'

export default function BuilderPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const userId = (session?.user as any)?.id || ''

  // read flags from callback URL
  const mode = (router.query.mode as 'signup'|'signin') || 'signup'
  const onboard = router.query.onboard === '1'
  const [open, setOpen] = useState(false)

  // require auth (middleware should also protect, this is a client fallback)
  useEffect(() => { if (status === 'unauthenticated') router.replace('/login') }, [status])

  // show overlay for first-time signup (per user) or when explicitly requested (?onboard=1)
  useEffect(() => {
    if (status !== 'authenticated' || !userId) return
    const done = typeof window !== 'undefined' && localStorage.getItem(`user:${userId}:profile:completed`) === '1'
    if (onboard || (!done && mode === 'signup')) setOpen(true)
  }, [status, userId, onboard, mode])

  function handleDone() {
    setOpen(false)
    // clean query so refresh doesn’t re-open overlay
    const q = { ...router.query }
    delete q.onboard; delete q.mode
    router.replace({ pathname: router.pathname, query: q }, undefined, { shallow: true })
  }

  return (
    <>
      {/* ======= Your existing Builder UI goes here ======= */}
      <div style={{ color: '#fff' }}>
        <h1 className="text-2xl font-bold">Builder</h1>
        <p className="text-white/70 text-sm">Start building your agent.</p>
        {/* ...rest of your builder content/components... */}
      </div>

      {/* Welcome overlay sits ABOVE the builder */}
      <OnboardingOverlay open={open} mode={mode} userId={userId} onDone={handleDone} />
    </>
  )
}
