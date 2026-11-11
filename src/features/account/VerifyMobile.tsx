import { useState } from 'react'
import { CheckCircle2, Smartphone } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Alert } from '@/components/ui/misc'
import { Button } from '@/components/ui/Button'
import { InputField } from '@/components/ui/Field'
import { useAuth } from '@/features/account/AuthProvider'
import { requireSupabase, friendlyError } from '@/lib/supabase'
import { normaliseUaeMobile } from '@/lib/phone'

/** Confirms a mobile number on the sign-in account with an SMS code (needed for installments). */
export function VerifyMobile() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [num, setNum] = useState('')
  const [sent, setSent] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const verified = done || !!user?.phone_confirmed_at

  if (verified) {
    return <p className="flex items-center gap-2 text-sm font-semibold text-success"><CheckCircle2 className="size-4" /> Mobile {sent ?? (user?.phone ? '+' + user.phone.replace(/^\+/, '') : '')} verified</p>
  }
  const send = async () => {
    const n = normaliseUaeMobile(num)
    if (!n) return setErr('Enter a valid UAE mobile number, e.g. 50 123 4567.')
    setBusy(true); setErr(null)
    const { error } = await requireSupabase().auth.updateUser({ phone: n })
    setBusy(false)
    if (error) return setErr(friendlyError(error))
    setSent(n)
  }
  const verify = async () => {
    setBusy(true); setErr(null)
    const { error } = await requireSupabase().auth.verifyOtp({ phone: sent!, token: code.trim(), type: 'phone_change' })
    setBusy(false)
    if (error) return setErr('That code is not right or has expired.')
    setDone(true)
    qc.invalidateQueries({ queryKey: ['installments', 'eligibility'] })
  }
  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-sm text-navy-800"><Smartphone className="size-4 text-gold-700" /> Verify your mobile number with a one-time SMS code. Needed for installments.</p>
      {!sent ? (
        <div className="flex flex-wrap items-end gap-2">
          <InputField label="Mobile number" type="tel" inputMode="tel" placeholder="50 123 4567" value={num} onChange={(e) => setNum(e.target.value)} className="min-w-52 flex-1" />
          <Button variant="navy" loading={busy} onClick={send}>Send code</Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <InputField label={`Code sent to ${sent}`} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="min-w-40 flex-1" />
          <Button loading={busy} onClick={verify} disabled={code.length !== 6}>Verify</Button>
          <Button variant="ghost" onClick={() => { setSent(null); setCode('') }}>Change number</Button>
        </div>
      )}
      {err && <Alert tone="error">{err}</Alert>}
    </div>
  )
}
