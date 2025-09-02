import { useRouter } from 'next/router'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import OnboardingOverlay from '../../components/ui/OnboardingOverlay'

export default function BuilderPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [open, setOpen] = useState(false)

  // read query flags sent from Google callback
  const mode = (router.query.mode as 'signup'|'signin') || 'signup'
  const onboard = router.query.onboard === '1'

  // gate
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
  }, [status])

  // show overlay on first signup or when ?onboard=1
  useEffect(() => {
    const completed = typeof window !== 'undefined' && localStorage.getItem('profile:completed') === '1'
    if (status === 'authenticated') {
      if (onboard || (!completed && mode === 'signup')) setOpen(true)
    }
  }, [status, onboard, mode])

  function done() {
    setOpen(false)
    // clean query so refresh doesn’t reopen
    const q = { ...router.query }
    delete q.onboard; delete q.mode
    router.replace({ pathname: router.pathname, query: q }, undefined, { shallow: true })
  }

  return (
    <>
      {/* YOUR existing Builder UI here */}

      <OnboardingOverlay open={open} mode={mode} onDone={done} />
    </>
  )
}
