import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { InputField } from '@/components/ui/Field'
import { Alert } from '@/components/ui/misc'
import { Monogram } from '@/components/brand/Logo'
import { useAuth } from '@/features/account/AuthProvider'
import { clearReferral, storedReferral } from '@/features/account/referralCapture'
import { requireSupabase, friendlyError, supabase } from '@/lib/supabase'
import { useDocumentMeta } from '@/lib/meta'
import { cn } from '@/lib/cn'

/**
 * Sign-in is always two steps: password, then a code (6 to 8 digits) emailed to the account.
 * The server enforces it (see migration login_two_step): a password alone never gives a session.
 */
type Mode = 'signin' | 'signup' | 'reset'
type Step = 'start' | 'code' | 'newpw'

const MIN_PW = 8
const LOGIN_ERRORS: Record<string, string> = {
  invalid_credentials: 'Wrong email or password.',
  email_not_confirmed: 'Please confirm your email first: create the account again with the same email to get a new code, or use "Forgot password".',
  too_many_attempts: 'Too many attempts. Please wait a while and try again.',
}

export function LoginPage() {
  useDocumentMeta({ title: 'Sign in', noindex: true })
  const { user, ready } = useAuth()
  const [sp] = useSearchParams()
  const next = safeNext(sp.get('next'))
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('signin')
  const [step, setStep] = useState<Step>('start')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const referral = storedReferral()

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  if (!supabase) return <div className="container-x py-16"><Alert title="Sign-in opens soon">Accounts will be available when the store opens.</Alert></div>
  const resetLink = sp.get('reset') === '1'
  if (ready && user && step !== 'newpw' && !resetLink) return <Navigate to={next} replace />

  const target = email.trim().toLowerCase()
  // Emails carry a code, and (with Supabase's default email template) a sign-in link. A link
  // opened on this device lands back here signed in; a reset link comes back with ?reset=1.
  const linkBack = (reset: boolean) => `${window.location.origin}/login?${new URLSearchParams({ next, ...(reset ? { reset: '1' } : {}) })}`
  const switchMode = (m: Mode) => { setMode(m); setStep('start'); setError(null); setCode('') }

  /** Step 1: check the password (or create the account / ask for a reset), which emails a code. */
  const start = async (e?: FormEvent) => {
    e?.preventDefault()
    setError(null)
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(target)) return setError('Please enter a valid email address.')
    if (mode !== 'reset' && password.length < MIN_PW) return setError(`Password must be at least ${MIN_PW} characters.`)
    if (mode === 'signup' && name.trim().length < 2) return setError('Please enter your name.')
    const db = requireSupabase()
    setBusy(true)
    try {
      if (mode === 'signin') {
        const { data, error } = await db.rpc('start_password_login', { p_email: target, p_password: password })
        if (error) return setError(friendlyError(error))
        if (data !== 'ok') return setError(LOGIN_ERRORS[data as string] ?? 'Could not sign in. Please try again.')
        const sent = await db.auth.signInWithOtp({ email: target, options: { shouldCreateUser: false, emailRedirectTo: linkBack(false) } })
        if (sent.error) return setError(friendlyError(sent.error))
      } else if (mode === 'signup') {
        const { data, error } = await db.auth.signUp({ email: target, password, options: { emailRedirectTo: linkBack(false), data: { full_name: name.trim(), referral_code: referral ?? undefined } } })
        if (error) return setError(friendlyError(error))
        if (data.user && data.user.identities?.length === 0) return setError('An account with this email already exists. Please sign in.')
      } else {
        const { data, error } = await db.rpc('start_password_reset', { p_email: target })
        if (error) return setError(friendlyError(error))
        if (data !== 'ok') return setError(LOGIN_ERRORS[data as string] ?? 'Could not send a code. Please try again.')
        const sent = await db.auth.signInWithOtp({ email: target, options: { shouldCreateUser: false, emailRedirectTo: linkBack(true) } })
        if (sent.error) return setError(/signups not allowed/i.test(sent.error.message) ? 'No account uses this email. Please create an account.' : friendlyError(sent.error))
      }
      setStep('code')
      setCooldown(30)
    } finally {
      setBusy(false)
    }
  }

  /** Step 2: the emailed code. */
  const verify = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!/^\d{6,8}$/.test(code)) return setError("Enter the code from the email.")
    setBusy(true)
    const type = mode === 'signup' ? 'signup' : 'email'
    if (mode === 'reset') setStep('newpw') // keep this page open once the reset code signs the user in
    const { error } = await requireSupabase().auth.verifyOtp({ email: target, token: code, type })
    setBusy(false)
    if (error) {
      if (mode === 'reset') setStep('code')
      if (/password_required/.test(error.message)) { setStep('start'); setCode(''); return setError('That took too long. Please enter your password again.') }
      return setError(/expired|invalid/i.test(error.message) ? 'That code is wrong or has expired. Please try again.' : friendlyError(error))
    }
    if (mode === 'reset') return
    clearReferral()
    navigate(next, { replace: true })
  }

  /** Reset step 3: choose a new password. */
  const savePassword = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (newPassword.length < MIN_PW) return setError(`Password must be at least ${MIN_PW} characters.`)
    setBusy(true)
    const { error } = await requireSupabase().auth.updateUser({ password: newPassword })
    setBusy(false)
    if (error) return setError(friendlyError(error))
    navigate(next, { replace: true })
  }

  const subtitle = resetLink && user ? 'Choose a new password for your account.'
    : mode === 'signup' ? 'Create your account. We will email you a code to confirm it.'
    : mode === 'reset' ? 'We will email you a code to set a new password.'
    : 'Sign in with your password, then the code we email you.'

  return (
    <div className="container-x grid min-h-[70vh] place-items-center py-12">
      <div className="card w-full max-w-md p-6 sm:p-8">
        <div className="flex flex-col items-center text-center">
          <Monogram className="size-14" />
          <h1 className="mt-3 font-display text-3xl font-semibold text-navy-900">
            {mode === 'signup' ? 'Create account' : mode === 'reset' || (resetLink && user) ? 'Reset password' : 'Welcome back'}
          </h1>
          <p className="mt-1 text-sm text-navy-700">{subtitle}</p>
        </div>

        {step === 'start' && !(resetLink && user) && (
          <form onSubmit={start} className="mt-6 space-y-4">
            {mode !== 'reset' && (
              <div className="grid grid-cols-2 gap-1 rounded-full bg-navy-50 p-1" role="tablist">
                {(['signin', 'signup'] as Mode[]).map((m) => (
                  <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => switchMode(m)}
                    className={cn('rounded-full py-2 text-sm font-semibold', mode === m ? 'bg-white text-navy-900 shadow' : 'text-navy-600')}>
                    {m === 'signin' ? 'Sign in' : 'Create account'}
                  </button>
                ))}
              </div>
            )}
            {mode === 'signup' && <InputField label="Your name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />}
            <InputField label="Email address" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            {mode !== 'reset' && (
              <InputField label="Password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password}
                onChange={(e) => setPassword(e.target.value)} hint={mode === 'signup' ? `At least ${MIN_PW} characters.` : undefined} required />
            )}
            {mode === 'signup' && referral && <p className="text-xs text-success">Invite code {referral} will be applied to your new account.</p>}
            {error && <Alert tone="error">{error}</Alert>}
            <Button type="submit" size="lg" className="w-full" loading={busy}>
              {mode === 'signin' ? 'Continue' : mode === 'signup' ? 'Create account' : 'Send reset code'}
            </Button>
            <div className="text-center text-sm">
              {mode === 'reset'
                ? <button type="button" className="text-navy-700 hover:underline" onClick={() => switchMode('signin')}>Back to sign in</button>
                : mode === 'signin' && <button type="button" className="font-semibold text-gold-700 hover:underline" onClick={() => switchMode('reset')}>Forgot password? (or first time setting one)</button>}
            </div>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={verify} className="mt-6 space-y-4">
            <p className="text-center text-sm text-navy-700">We emailed <strong>{target}</strong>. Enter the code, or open the link in that email on this device.</p>
            <InputField label="Code" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="[&_input]:text-center [&_input]:text-2xl [&_input]:tracking-[0.3em]" autoFocus />
            {error && <Alert tone="error">{error}</Alert>}
            <Button type="submit" size="lg" className="w-full" loading={busy}>Verify and continue</Button>
            <div className="flex justify-between text-sm">
              <button type="button" className="text-navy-700 hover:underline" onClick={() => { setStep('start'); setCode(''); setError(null) }}>Back</button>
              <button type="button" className="font-semibold text-gold-700 disabled:text-navy-600/40" disabled={cooldown > 0 || busy} onClick={() => start()}>
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
              </button>
            </div>
          </form>
        )}

        {(step === 'newpw' || (resetLink && user && step === 'start')) && (
          <form onSubmit={savePassword} className="mt-6 space-y-4">
            <InputField label="New password" type="password" autoComplete="new-password" value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)} hint={`At least ${MIN_PW} characters.`} autoFocus required />
            {error && <Alert tone="error">{error}</Alert>}
            <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!user}>Save password</Button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-navy-600/70">By continuing you agree to our <a href="/policies/terms" className="underline">Terms</a> and <a href="/policies/privacy" className="underline">Privacy Policy</a>.</p>
      </div>
    </div>
  )
}

/** Only allow redirects to our own pages. */
function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/account'
}
