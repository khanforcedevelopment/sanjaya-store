import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, CheckCircle2, Clock, FileImage, ShieldCheck, XCircle } from 'lucide-react'
import { Alert, PageTitle, Skeleton } from '@/components/ui/misc'
import { Button, ButtonLink } from '@/components/ui/Button'
import { InputField, SelectField } from '@/components/ui/Field'
import { useAuth } from '@/features/account/AuthProvider'
import { requireSupabase, friendlyError, supabase } from '@/lib/supabase'
import { useDocumentMeta } from '@/lib/meta'

const DOCS = [
  { v: 'emirates_id', l: 'Emirates ID', hint: '784-1990-1234567-1' },
  { v: 'passport', l: 'Passport', hint: 'A1234567' },
  { v: 'driving_licence', l: 'UAE driving licence', hint: '1234567' },
]
const MAX = 8 * 1024 * 1024

function FilePick({ label, hint, file, onFile, capture }: { label: string; hint: string; file: File | null; onFile: (f: File | null) => void; capture?: 'user' | 'environment' }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-navy-900/20 p-4 text-sm hover:border-gold-500">
      {capture === 'user' ? <Camera className="size-6 text-gold-700" /> : <FileImage className="size-6 text-gold-700" />}
      <span className="min-w-0 flex-1"><span className="block font-semibold text-navy-900">{label}</span><span className="block truncate text-navy-600">{file ? file.name : hint}</span></span>
      <input type="file" accept="image/*,application/pdf" capture={capture} className="sr-only" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
    </label>
  )
}

export function VerifyIdentityPage() {
  useDocumentMeta({ title: 'Verify identity', noindex: true })
  const { user } = useAuth()
  const qc = useQueryClient()
  const db = requireSupabase()
  const { data: apps, isLoading } = useQuery({
    queryKey: ['kyc', user?.id],
    enabled: !!supabase && !!user,
    queryFn: async () => {
      const { data, error } = await db.from('kyc_applications').select('id, status, document_type, document_last4, decision_reasons, created_at').order('created_at', { ascending: false }).limit(5)
      if (error) throw error
      return data
    },
  })
  const [type, setType] = useState('emirates_id')
  const [number, setNumber] = useState('')
  const [name, setName] = useState('')
  const [front, setFront] = useState<File | null>(null)
  const [back, setBack] = useState<File | null>(null)
  const [selfie, setSelfie] = useState<File | null>(null)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const latest = apps?.[0]
  const submit = async () => {
    setErr(null)
    if (!front || !selfie) return setErr('Add a photo of your document and a selfie.')
    if ([front, back, selfie].some((f) => f && f.size > MAX)) return setErr('Each file must be 8 MB or smaller.')
    if (!consent) return setErr('Please agree to the identity check.')
    setBusy(true)
    try {
      const stamp = Date.now()
      const paths: string[] = []
      for (const [tag, f] of [['front', front], ['back', back], ['selfie', selfie]] as const) {
        if (!f) continue
        const ext = (f.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
        const path = `${user!.id}/${stamp}-${tag}.${ext}`
        const { error } = await db.storage.from('kyc-documents').upload(path, f, { contentType: f.type || 'image/jpeg' })
        if (error) throw error
        paths.push(path)
      }
      const { data, error } = await db.functions.invoke<{ status?: string; error?: string }>('kyc-submit', {
        body: { document_type: type, document_number: number, name_on_document: name, paths, consent: true },
      })
      if (error) {
        let msg = 'Could not submit your documents. Please try again.'
        try { const b = await (error as { context?: Response }).context?.json(); if (b?.error) msg = b.error } catch { /* keep default */ }
        throw new Error(msg)
      }
      if (data?.error) throw new Error(data.error)
      await qc.invalidateQueries({ queryKey: ['kyc'] })
      await qc.invalidateQueries({ queryKey: ['installments', 'eligibility'] })
    } catch (e) {
      setErr(e instanceof Error ? e.message : friendlyError(e))
    } finally { setBusy(false) }
  }

  if (isLoading) return <Skeleton className="h-64" />
  const docLabel = (v: string | null) => DOCS.find((d) => d.v === v)?.l ?? 'Document'

  return (
    <>
      <PageTitle title="Verify your identity" subtitle="Needed once to use monthly installments. Our team reviews it within one working day." />
      {latest?.status === 'approved' ? (
        <Alert tone="success" title="Identity verified"><span className="flex items-center gap-2"><CheckCircle2 className="size-4" /> {docLabel(latest.document_type)} ending {latest.document_last4} was approved.</span> <ButtonLink to="/installments" size="sm" variant="outline" className="mt-3">See installments</ButtonLink></Alert>
      ) : latest && (latest.status === 'manual_review' || latest.status === 'pending') ? (
        <Alert tone="info" title="Documents received"><span className="flex items-center gap-2"><Clock className="size-4" /> We are checking your {docLabel(latest.document_type)} ending {latest.document_last4}. You will get an email when it is done.</span></Alert>
      ) : (
        <div className="space-y-5">
          {latest?.status === 'rejected' && (
            <Alert tone="error" title="Not approved"><span className="flex items-start gap-2"><XCircle className="mt-0.5 size-4 shrink-0" /> {latest.decision_reasons.join('. ') || 'Please try again with clear photos.'}</span></Alert>
          )}
          <section className="card space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label="Document" value={type} onChange={(e) => setType(e.target.value)}>
                {DOCS.map((d) => <option key={d.v} value={d.v}>{d.l}</option>)}
              </SelectField>
              <InputField label="Document number" value={number} onChange={(e) => setNumber(e.target.value.toUpperCase())} placeholder={DOCS.find((d) => d.v === type)?.hint} autoComplete="off" maxLength={20} />
              <InputField label="Name as printed on the document" className="sm:col-span-2" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <FilePick label="Document front" hint="Clear photo, all corners visible" file={front} onFile={setFront} capture="environment" />
              <FilePick label="Document back" hint="Optional: back side of Emirates ID or licence" file={back} onFile={setBack} capture="environment" />
              <FilePick label="Selfie" hint="Your face, holding the document" file={selfie} onFile={setSelfie} capture="user" />
            </div>
            <p className="text-xs text-navy-600">Your document number is never stored, only a secure fingerprint to stop duplicate accounts and its last 4 characters. Photos are visible only to the Super Admin.</p>
            <label className="flex items-start gap-2 text-sm font-medium text-navy-900">
              <input type="checkbox" className="mt-0.5 size-4 accent-gold-500" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              I agree that Sanjaya Trading FZE may check these documents to verify my identity for installment plans.
            </label>
            {err && <Alert tone="error">{err}</Alert>}
            <Button loading={busy} onClick={submit}><ShieldCheck className="size-4" /> Submit for review</Button>
          </section>
        </div>
      )}
    </>
  )
}
