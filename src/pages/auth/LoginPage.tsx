import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Mail, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { InputField } from '@/components/ui/Field'
import { Alert } from '@/components/ui/misc'
import { Monogram } from '@/components/brand/Logo'
import { useAuth } from '@/features/account/AuthProvider'
import { clearReferral, storedReferral } from '@/features/account/referralCapture'
import { requireSupabase, friendlyError, supabase } from '@/lib/supabase'
import { normaliseIndianMobile } from '@/lib/phone'
import { useDocumentMeta } from '@/lib/meta'
import { cn } from '@/lib/cn'

type Method = 'email' | 'phone'

export function LoginPage() {
  useDocumentMeta({ title: 'Sign in', noindex: true })
  const { user, ready } = useAuth()
  const [sp] = useSearchParams()
  const next = safeNext(sp.get('next'))
  const navigate = useNavigate()
  const [method, setMethod] = useState<Method>('email')
  const [step, setStep] = useState<'start' | 'code'>('start')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
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
  if (ready && user) return <Navigate to={next} replace />

  const target = method === 'email' ? email.trim().toLowerCase() : normaliseIndianMobile(phone)

  const send = async (e?: FormEvent) => {
    e?.preventDefault()
    setError(null)
    if (method === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(target ?? '')) return setError('Please enter a valid email address.')
    if (method === 'phone' && !target) return setError('Please enter a valid 10-digit Indian mobile number.')
    setBusy(true)
    const data = { full_name: name.trim() || undefined, referral_code: referral ?? undefined }
    const { error } = method === 'email'
      ? await requireSupabase().auth.signInWithOtp({ email: target!, options: { shouldCreateUser: true, data } })
      : await requireSupabase().auth.signInWithOtp({ phone: target!, options: { shouldCreateUser: true, data } })
    setBusy(false)
    if (error) return setError(friendlyError(error))
    setStep('code')
    setCooldown(30)
  }

  const verify = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!/^\d{6}$/.test(code)) return setError('Enter the 6-digit code.')
    setBusy(true)
    const { error } = method === 'email'
      ? await requireSupabase().auth.verifyOtp({ email: target!, token: code, type: 'email' })
      : await requireSupabase().auth.verifyOtp({ phone: target!, token: code, type: 'sms' })
    setBusy(false)
    if (error) return setError(/expired|invalid/i.test(error.message) ? 'That code is wrong or has expired. Please try again.' : friendlyError(error))
    clearReferral()
    navigate(next, { replace: true })
  }

  return (
    <div className="container-x grid min-h-[70vh] place-items-center py-12">
      <div className="card w-full max-w-md p-6 sm:p-8">
        <div className="flex flex-col items-center text-center">
          <Monogram className="size-14" />
          <h1 className="mt-3 font-display text-3xl font-semibold text-navy-900">Welcome to Sanjaya</h1>
          <p className="mt-1 text-sm text-navy-700">Sign in or create an account with a one-time code. No password needed.</p>
        </div>

        {step === 'start' ? (
          <form onSubmit={send} className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-1 rounded-full bg-navy-50 p-1" role="tablist">
              {(['email', 'phone'] as Method[]).map((m) => (
                <button key={m} type="button" role="tab" aria-selected={method === m} onClick={() => { setMethod(m); setError(null) }}
                  className={cn('flex items-center justify-center gap-2 rounded-full py-2 text-sm font-semibold', method === m ? 'bg-white text-navy-900 shadow' : 'text-navy-600')}>
                  {m === 'email' ? <Mail className="size-4" /> : <Smartphone className="size-4" />}{m === 'email' ? 'Email' : 'Mobile'}
                </button>
              ))}
            </div>
            {method === 'email'
              ? <InputField label="Email address" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              : <InputField label="Mobile number" type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} hint="We will text you a 6-digit code." required />}
            <InputField label="Your name (for new accounts)" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
            {referral && <p className="text-xs text-success">Invite code {referral} will be applied to your new account.</p>}
            {error && <Alert tone="error">{error}</Alert>}
            <Button type="submit" size="lg" className="w-full" loading={busy}>Send code</Button>
          </form>
        ) : (
          <form onSubmit={verify} className="mt-6 space-y-4">
            <p className="text-center text-sm text-navy-700">We sent a 6-digit code to <strong>{method === 'email' ? email : target}</strong>.</p>
            <InputField label="Code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="[&_input]:text-center [&_input]:text-2xl [&_input]:tracking-[0.5em]" autoFocus />
            {error && <Alert tone="error">{error}</Alert>}
            <Button type="submit" size="lg" className="w-full" loading={busy}>Verify and continue</Button>
            <div className="flex justify-between text-sm">
              <button type="button" className="text-navy-700 hover:underline" onClick={() => { setStep('start'); setCode('') }}>Change {method === 'email' ? 'email' : 'number'}</button>
              <button type="button" className="font-semibold text-gold-700 disabled:text-navy-600/40" disabled={cooldown > 0 || busy} onClick={() => send()}>
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
              </button>
            </div>
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
