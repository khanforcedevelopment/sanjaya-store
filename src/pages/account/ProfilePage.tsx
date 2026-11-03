import { useState, type FormEvent } from 'react'
import { PageTitle, Alert } from '@/components/ui/misc'
import { InputField } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/features/account/AuthProvider'
import { requireSupabase, friendlyError } from '@/lib/supabase'
import { normaliseIndianMobile } from '@/lib/phone'
import { useDocumentMeta } from '@/lib/meta'
import { VerifyMobile } from '@/features/account/VerifyMobile'

export function ProfilePage() {
  useDocumentMeta({ title: 'Profile', noindex: true })
  const { profile, user, refreshProfile } = useAuth()
  const toast = useToast()
  const [name, setName] = useState(profile?.full_name ?? '')
  const [phone, setPhone] = useState(profile?.phone?.replace(/^\+91/, '') ?? '')
  const [optIn, setOptIn] = useState(profile?.marketing_opt_in ?? false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (name.trim().length < 2) return setError('Please enter your full name.')
    const normalised = phone.trim() ? normaliseIndianMobile(phone) : null
    if (phone.trim() && !normalised) return setError('Enter a valid 10-digit Indian mobile number, or leave it empty.')
    setBusy(true)
    const { error } = await requireSupabase().from('profiles')
      .update({ full_name: name.trim(), phone: normalised, marketing_opt_in: optIn }).eq('id', user!.id)
    setBusy(false)
    if (error) return setError(friendlyError(error))
    await refreshProfile()
    toast('Profile saved')
  }

  return (
    <>
      <PageTitle title="Profile" subtitle="How we address you and reach you about orders." />
      <form onSubmit={save} className="card max-w-xl space-y-4 p-6">
        <InputField label="Full name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        <InputField label="Sign-in" value={user?.email ?? user?.phone ?? ''} readOnly disabled hint="This is the email or number you use to sign in." />
        <InputField label="Contact mobile" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="98765 43210" value={phone}
          onChange={(e) => setPhone(e.target.value)} hint="Used for order and delivery updates." />
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} className="mt-0.5 size-4 accent-gold-500" />
          <span>Send me offers and new arrivals by email and WhatsApp. You can turn this off at any time.</span>
        </label>
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" loading={busy}>Save changes</Button>
      </form>
      <section className="card mt-6 max-w-xl p-6">
        <h2 className="mb-3 font-semibold text-navy-900">Verified mobile</h2>
        <VerifyMobile />
      </section>
    </>
  )
}
