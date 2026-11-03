import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Badge } from '@/components/ui/misc'
import { Button } from '@/components/ui/Button'
import { InputField } from '@/components/ui/Field'
import { requireSupabase, friendlyError } from '@/lib/supabase'
import { AdminTitle } from './ui'

type App = {
  id: string; status: string; document_type: string | null; document_last4: string | null; name_on_document: string | null
  document_paths: string[]; risk_flags: string[]; decision_reasons: string[]; created_at: string
  user: { full_name: string | null; phone: string | null } | null
}
const DOC: Record<string, string> = { pan: 'PAN', passport: 'Passport', driving_licence: 'Driving licence', voter_id: 'Voter ID' }

function Files({ paths }: { paths: string[] }) {
  const db = requireSupabase()
  const { data } = useQuery({
    queryKey: ['admin', 'kyc-files', paths],
    staleTime: 4 * 60_000,
    queryFn: async () => {
      const { data, error } = await db.storage.from('kyc-documents').createSignedUrls(paths, 300)
      if (error) throw error
      return data
    },
  })
  return (
    <div className="grid grid-cols-3 content-start gap-2 self-start">
      {data?.map((f) => f.signedUrl && (
        <a key={f.path} href={f.signedUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-navy-100 bg-navy-50">
          {/\.pdf$/i.test(f.path ?? '') ? <span className="flex aspect-square items-center justify-center text-sm font-semibold">PDF</span>
            : <img src={f.signedUrl} alt={(f.path ?? '').split('-').pop()} className="aspect-square w-full object-cover" />}
          <span className="block px-2 py-1 text-xs capitalize text-navy-700">{(f.path ?? '').split('-').pop()?.split('.')[0]}</span>
        </a>
      ))}
    </div>
  )
}

function AppCard({ a }: { a: App }) {
  const db = requireSupabase()
  const qc = useQueryClient()
  const [reason, setReason] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const decide = async (status: 'approved' | 'rejected') => {
    if (!reason.trim()) return setErr(status === 'approved' ? 'Write what you checked, e.g. "Name and photo match".' : 'Write why, the customer will see it.')
    setBusy(true)
    const { error } = await db.rpc('decide_kyc', { p_application: a.id, p_status: status, p_reason: reason.trim() })
    setBusy(false)
    if (error) setErr(friendlyError(error)); else qc.invalidateQueries({ queryKey: ['admin', 'kyc'] })
  }
  return (
    <article className="card grid gap-4 p-4 text-sm lg:grid-cols-[1fr_360px]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-navy-900">{a.user?.full_name || 'Customer'}</p>
          <Badge tone={a.status === 'approved' ? 'green' : a.status === 'rejected' ? 'red' : 'amber'}>{a.status.replace('_', ' ')}</Badge>
          {a.risk_flags.map((f) => <Badge key={f} tone="red">{f.replace('_', ' ')}</Badge>)}
        </div>
        <p className="mt-1 text-navy-700">{a.user?.phone} · submitted {new Date(a.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
        <dl className="mt-3 grid grid-cols-[120px_1fr] gap-1">
          <dt className="text-navy-600">Document</dt><dd>{DOC[a.document_type ?? ''] ?? a.document_type} ending <strong>{a.document_last4}</strong></dd>
          <dt className="text-navy-600">Name on it</dt><dd>{a.name_on_document}</dd>
        </dl>
        {a.decision_reasons.length > 0 && <p className="mt-2 text-xs text-navy-600">{a.decision_reasons.join(' · ')}</p>}
        {a.status === 'manual_review' && (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-navy-700">Check: the name matches the account, the selfie shows the same person as the document photo, and the document looks genuine and unexpired.</p>
            <InputField label="Reason (saved, shown to the customer if rejected)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
            {err && <Alert tone="error">{err}</Alert>}
            <div className="flex gap-2"><Button size="sm" loading={busy} onClick={() => decide('approved')}>Approve</Button><Button size="sm" variant="danger" loading={busy} onClick={() => decide('rejected')}>Reject</Button></div>
          </div>
        )}
      </div>
      {a.document_paths.length > 0 && <Files paths={a.document_paths} />}
    </article>
  )
}

export function AdminKyc() {
  const db = requireSupabase()
  const [show, setShow] = useState<'manual_review' | 'decided'>('manual_review')
  const { data, error } = useQuery({
    queryKey: ['admin', 'kyc', show],
    queryFn: async () => {
      let q = db.from('kyc_applications').select('id, status, document_type, document_last4, name_on_document, document_paths, risk_flags, decision_reasons, created_at, user:profiles!kyc_applications_user_id_fkey(full_name, phone)').order('created_at', { ascending: show === 'manual_review' }).limit(100)
      q = show === 'manual_review' ? q.eq('status', 'manual_review') : q.in('status', ['approved', 'rejected'])
      const { data, error } = await q
      if (error) throw error
      return data as unknown as App[]
    },
  })
  return (
    <>
      <AdminTitle title="Identity checks" subtitle="Approve only when you are sure. Photo links expire after 5 minutes.">
        <Button size="sm" variant={show === 'manual_review' ? 'navy' : 'outline'} onClick={() => setShow('manual_review')}>To review</Button>
        <Button size="sm" variant={show === 'decided' ? 'navy' : 'outline'} onClick={() => setShow('decided')}>Decided</Button>
      </AdminTitle>
      {error && <Alert tone="error">{friendlyError(error)}</Alert>}
      {data?.length === 0 && <p className="card p-6 text-center text-sm text-navy-600">Nothing waiting.</p>}
      <div className="grid gap-4">{data?.map((a) => <AppCard key={a.id} a={a} />)}</div>
    </>
  )
}
