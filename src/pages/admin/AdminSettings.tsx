import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { Alert } from '@/components/ui/misc'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { requireSupabase, friendlyError } from '@/lib/supabase'
import type { Json } from '@/types/database'
import { AdminTitle, aedInput } from './ui'

const SECTIONS: { key: string; title: string; note?: string }[] = [
  { key: 'dashboard', title: 'Dashboard', note: 'monthly_target is the sales goal on the Overview page (AED). The warehouse pin is the starting point on the fleet map.' },
  { key: 'delivery', title: 'Delivery', note: 'default_fee is charged per order after the first free order.' },
  { key: 'flash_sale', title: 'Flash sale', note: 'Products tagged with the tag below appear in the flash sale. ends_at is an ISO time, e.g. 2026-11-30T23:59:00+05:30.' },
  { key: 'payments', title: 'Payments' },
  { key: 'installments', title: 'Installments' },
  { key: 'loyalty', title: 'Loyalty points' },
  { key: 'returns', title: 'Returns' },
  { key: 'notifications', title: 'Notifications' },
  { key: 'store', title: 'Store details', note: 'Shown in the footer, invoices and legal pages.' },
]

/** Flags that move real money. They need a typed confirmation and are blocked server-side without live keys. */
const DANGEROUS = new Set(['payments.live_enabled', 'installments.live_enabled'])

type Obj = Record<string, Json>
const label = (k: string) => k.replace(/_paise$/, '').replace(/_/g, ' ')

function SettingCard({ k, title, note, value }: { k: string; title: string; note?: string; value: Obj }) {
  const db = requireSupabase()
  const qc = useQueryClient()
  const toast = useToast()
  const [draft, setDraft] = useState<Obj>(value)
  const [text, setText] = useState<Record<string, string>>({})
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(value) || Object.keys(text).length > 0

  const save = async () => {
    const next: Obj = { ...draft }
    for (const [f, raw] of Object.entries(text)) {
      const orig = value[f]
      if (f.endsWith('_paise')) {
        const p = raw.trim() === '' && orig === null ? null : aedInput(raw)
        if (p === null && raw.trim() !== '') { setErr(`${label(f)}: enter an amount in AED`); return }
        next[f] = p
      } else if (typeof orig === 'number') {
        const n = Number(raw)
        if (!Number.isFinite(n)) { setErr(`${label(f)}: enter a number`); return }
        next[f] = n
      } else next[f] = raw.trim() === '' ? null : raw.trim()
    }
    for (const f of Object.keys(next)) {
      const path = `${k}.${f}`
      if (DANGEROUS.has(path) && next[f] === true && value[f] !== true) {
        const typed = window.prompt(`This turns on LIVE ${k}. Real customer money will move. Type LIVE to confirm.`)
        if (typed !== 'LIVE') { setErr('Not changed. Live mode needs the word LIVE.'); return }
      }
    }
    setBusy(true)
    const { error } = await db.rpc('update_setting', { p_key: k, p_value: next })
    setBusy(false)
    if (error) { setErr(friendlyError(error)); return }
    setErr(null); setText({}); setDraft(next)
    toast(`${title} saved`)
    qc.invalidateQueries({ queryKey: ['admin', 'settings'] })
    qc.invalidateQueries({ queryKey: ['settings'] })
  }

  return (
    <section className="card p-5">
      <h2 className="font-display text-xl font-semibold text-navy-900">{title}</h2>
      {note && <p className="mb-3 text-xs text-navy-600">{note}</p>}
      {err && <div className="mb-3"><Alert tone="error">{err}</Alert></div>}
      <div className="grid gap-3 sm:grid-cols-2">
        {Object.entries(draft).map(([f, v]) => {
          const danger = DANGEROUS.has(`${k}.${f}`)
          if (typeof v === 'boolean') {
            return (
              <label key={f} className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${danger ? 'border-danger/40 bg-danger/5' : 'border-navy-100'}`}>
                <input type="checkbox" className="size-4 accent-gold-500" checked={v} onChange={(e) => setDraft({ ...draft, [f]: e.target.checked })} />
                <span className="capitalize">{label(f)}</span>
                {danger && <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-danger"><AlertTriangle className="size-3.5" /> Real money</span>}
              </label>
            )
          }
          if (v !== null && typeof v === 'object') return null
          const shown = text[f] ?? (v === null ? '' : f.endsWith('_paise') && typeof v === 'number' ? String(v / 100) : String(v))
          return (
            <label key={f} className="block text-sm">
              <span className="mb-1 block font-medium capitalize text-navy-800">{label(f)}{f.endsWith('_paise') && ' (AED)'}</span>
              <input className="input" value={shown} onChange={(e) => setText({ ...text, [f]: e.target.value })} inputMode={typeof v === 'number' ? 'decimal' : undefined} />
            </label>
          )
        })}
      </div>
      <div className="mt-4 flex justify-end"><Button size="sm" disabled={!dirty} loading={busy} onClick={save}>Save {title.toLowerCase()}</Button></div>
    </section>
  )
}

export function AdminSettings() {
  const db = requireSupabase()
  const { data, error } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: async () => { const { data, error } = await db.from('site_settings').select('key, value'); if (error) throw error; return data },
  })
  const byKey = new Map(data?.map((r) => [r.key, r.value as Obj]))
  return (
    <>
      <AdminTitle title="Settings" subtitle="Only the Super Admin can change these. Every change is written to the audit log." />
      <div className="mb-5"><Alert tone="warning" title="Live payments stay off">Live card payments and live installments must stay off until the Stripe live account, KYC provider and legal pages are ready. The server also refuses live Stripe keys while the switch is off.</Alert></div>
      {error && <Alert tone="error">{friendlyError(error)}</Alert>}
      <div className="grid gap-5">
        {SECTIONS.filter((s) => byKey.has(s.key)).map((s) => (
          <SettingCard key={s.key + JSON.stringify(byKey.get(s.key))} k={s.key} title={s.title} note={s.note} value={byKey.get(s.key)!} />
        ))}
      </div>
    </>
  )
}
