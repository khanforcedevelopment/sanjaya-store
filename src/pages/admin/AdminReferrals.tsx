import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Badge } from '@/components/ui/misc'
import { Button } from '@/components/ui/Button'
import { InputField, SelectField } from '@/components/ui/Field'
import { formatINR } from '@/lib/money'
import { requireSupabase, friendlyError } from '@/lib/supabase'
import type { Tables } from '@/types/database'
import { AdminTitle, Table, Td, rupeesInput } from './ui'

type Campaign = Tables<'referral_campaigns'>
const blank = { name: '', headline: '', required_referrals: '5', reward_type: 'coupon', reward_value: '', reward_description: '', ends_at: '' }

function CampaignForm({ c, onDone }: { c?: Campaign; onDone: () => void }) {
  const db = requireSupabase()
  const [f, setF] = useState(c ? {
    name: c.name, headline: c.headline, required_referrals: String(c.required_referrals), reward_type: c.reward_type,
    reward_value: c.reward_type === 'points' ? String(c.reward_value) : String(c.reward_value / 100), reward_description: c.reward_description,
    ends_at: c.ends_at ? c.ends_at.slice(0, 10) : '',
  } : blank)
  const [err, setErr] = useState<string | null>(null)
  const set = (k: keyof typeof blank) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const save = async () => {
    const n = Number(f.required_referrals)
    const value = f.reward_type === 'points' ? Number(f.reward_value) : rupeesInput(f.reward_value)
    if (!f.name.trim() || !f.headline.trim() || !f.reward_description.trim()) return setErr('Fill in name, headline and reward description.')
    if (!Number.isInteger(n) || n < 1 || n > 100) return setErr('Friends needed must be 1 to 100.')
    if (value === null || !Number.isFinite(value) || value < 0) return setErr('Enter the reward value.')
    const row = { name: f.name.trim(), headline: f.headline.trim(), required_referrals: n, reward_type: f.reward_type, reward_value: Math.round(value),
      reward_description: f.reward_description.trim(), ends_at: f.ends_at ? `${f.ends_at}T23:59:59+05:30` : null }
    const { error } = c ? await db.from('referral_campaigns').update(row).eq('id', c.id) : await db.from('referral_campaigns').insert(row)
    if (error) return setErr(friendlyError(error))
    onDone()
  }
  return (
    <div className="card grid gap-3 p-4 sm:grid-cols-3">
      <InputField label="Internal name" value={f.name} onChange={set('name')} />
      <InputField label="Headline customers see" value={f.headline} onChange={set('headline')} className="sm:col-span-2" placeholder="Invite 5 friends, get a free gift" />
      <InputField label="Friends needed" inputMode="numeric" value={f.required_referrals} onChange={set('required_referrals')} />
      <SelectField label="Reward" value={f.reward_type} onChange={set('reward_type')}>
        <option value="coupon">Coupon (₹ off)</option><option value="gift">Gift voucher (₹) + gift</option><option value="points">Loyalty points</option>
      </SelectField>
      <InputField label={f.reward_type === 'points' ? 'Points' : 'Value ₹'} inputMode="decimal" value={f.reward_value} onChange={set('reward_value')} />
      <InputField label="Reward description" value={f.reward_description} onChange={set('reward_description')} className="sm:col-span-2" placeholder="Gift voucher worth ₹500" />
      <InputField label="Ends on (optional)" type="date" value={f.ends_at} onChange={set('ends_at')} />
      {err && <div className="sm:col-span-3"><Alert tone="error">{err}</Alert></div>}
      <div className="flex gap-2 sm:col-span-3"><Button size="sm" onClick={save}>{c ? 'Save campaign' : 'Add campaign'}</Button>{c && <Button size="sm" variant="ghost" onClick={onDone}>Cancel</Button>}</div>
    </div>
  )
}

export function AdminReferrals() {
  const db = requireSupabase()
  const qc = useQueryClient()
  const [err, setErr] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const refresh = () => { setEditing(null); qc.invalidateQueries({ queryKey: ['admin', 'referrals'] }) }
  const { data: campaigns } = useQuery({ queryKey: ['admin', 'referrals', 'campaigns'], queryFn: async () => { const { data, error } = await db.from('referral_campaigns').select('*').order('created_at'); if (error) throw error; return data } })
  const { data: grants } = useQuery({
    queryKey: ['admin', 'referrals', 'grants'],
    queryFn: async () => { const { data, error } = await db.from('reward_grants').select('id, milestone, reward_type, status, created_at, user:profiles!reward_grants_user_id_fkey(full_name, phone), coupon:coupons(code, discount_value)').order('created_at', { ascending: false }).limit(100); if (error) throw error; return data },
  })
  const { data: refs } = useQuery({ queryKey: ['admin', 'referrals', 'list'], queryFn: async () => { const { data, error } = await db.rpc('admin_referrals'); if (error) throw error; return data } })
  const run = async (p: PromiseLike<{ error: unknown }>) => { const { error } = await p; if (error) setErr(friendlyError(error)); else { setErr(null); refresh() } }
  const active = campaigns?.filter((c) => c.is_active).length ?? 0

  return (
    <>
      <AdminTitle title="Referrals" subtitle="A friend counts when their first order is delivered. Rewards are issued automatically at each milestone." />
      {err && <div className="mb-3"><Alert tone="error">{err}</Alert></div>}
      {active > 1 && <div className="mb-3"><Alert tone="warning">More than one campaign is active. Customers see the oldest active one; rewards are given for each.</Alert></div>}
      <h2 className="mb-2 font-semibold text-navy-900">Campaigns</h2>
      <div className="space-y-3">
        {campaigns?.map((c) => editing === c.id ? <CampaignForm key={c.id} c={c} onDone={refresh} /> : (
          <div key={c.id} className="card flex flex-wrap items-center gap-3 p-4 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-navy-900">{c.headline} {!c.is_active && <Badge tone="grey">off</Badge>}</p>
              <p className="text-navy-700">{c.required_referrals} friends → {c.reward_description} ({c.reward_type === 'points' ? `${c.reward_value} points` : formatINR(c.reward_value)}){c.ends_at ? ` · ends ${new Date(c.ends_at).toLocaleDateString('en-IN')}` : ''}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setEditing(c.id)}>Edit</Button>
            <Button size="sm" variant={c.is_active ? 'ghost' : 'navy'} onClick={() => run(db.from('referral_campaigns').update({ is_active: !c.is_active }).eq('id', c.id))}>{c.is_active ? 'Turn off' : 'Turn on'}</Button>
          </div>
        ))}
        {editing === 'new' ? <CampaignForm onDone={refresh} /> : <Button size="sm" variant="outline" onClick={() => setEditing('new')}>New campaign</Button>}
      </div>

      <h2 className="mb-2 mt-8 font-semibold text-navy-900">Rewards issued</h2>
      <Table head={['Customer', 'Milestone', 'Reward', 'Status', '']} empty={grants?.length === 0}>
        {grants?.map((g) => {
          const u = g.user as { full_name: string | null; phone: string | null } | null
          const cp = g.coupon as { code: string; discount_value: number } | null
          return (
            <tr key={g.id}>
              <Td>{u?.full_name ?? 'Customer'}<span className="block text-xs text-navy-600">{u?.phone}</span></Td>
              <Td>{g.milestone}</Td>
              <Td>{g.reward_type}{cp && <span className="block text-xs">{cp.code} · {formatINR(cp.discount_value)}</span>}</Td>
              <Td><Badge tone={g.status === 'fulfilled' ? 'green' : g.status === 'cancelled' ? 'grey' : 'amber'}>{g.status}</Badge></Td>
              <Td>{g.reward_type === 'gift' && g.status === 'issued' && <Button size="sm" variant="outline" onClick={() => run(db.from('reward_grants').update({ status: 'fulfilled' }).eq('id', g.id))}>Gift sent</Button>}</Td>
            </tr>
          )
        })}
      </Table>

      <h2 className="mb-2 mt-8 font-semibold text-navy-900">Referrals</h2>
      <Table head={['Referrer', 'Friend', 'Friend orders', 'Status', '']} empty={refs?.length === 0}>
        {refs?.map((r) => (
          <tr key={r.id}>
            <Td>{r.referrer_name ?? '—'}<span className="block text-xs text-navy-600">{r.referrer_phone}</span></Td>
            <Td>{r.referee_name ?? '—'}<span className="block text-xs text-navy-600">{r.referee_phone}</span>{r.same_phone && <Badge tone="red">same phone</Badge>}</Td>
            <Td>{r.referee_orders}</Td>
            <Td><Badge tone={r.status === 'qualified' ? 'green' : r.status === 'rejected' ? 'red' : 'grey'}>{r.status}</Badge></Td>
            <Td>{r.status !== 'rejected' && <Button size="sm" variant="ghost" onClick={() => { const why = window.prompt('Why reject this referral? (saved in the audit log)'); if (why?.trim()) run(db.rpc('reject_referral', { p_referral: r.id, p_reason: why.trim() })) }}>Reject</Button>}</Td>
          </tr>
        ))}
      </Table>
    </>
  )
}
