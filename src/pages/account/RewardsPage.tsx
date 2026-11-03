import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Gift, Share2, Star } from 'lucide-react'
import { Alert, Badge, PageTitle, Skeleton } from '@/components/ui/misc'
import { Button } from '@/components/ui/Button'
import { InputField } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/features/account/AuthProvider'
import { usePublicSetting } from '@/features/catalog/api'
import { requireSupabase, friendlyError, supabase } from '@/lib/supabase'
import { formatINR } from '@/lib/money'
import { useDocumentMeta } from '@/lib/meta'

type Summary = {
  referral_code: string; joined: number; qualified: number; points: number
  friends: { name: string; status: string; joined_at: string }[]
  campaign: { headline: string; required_referrals: number; reward_description: string } | null
  rewards: { milestone: number; status: string; coupon_code: string | null; coupon_value_paise: number | null; expires_at: string | null; coupon_used: boolean }[]
}

export function RewardsPage() {
  useDocumentMeta({ title: 'Rewards', noindex: true })
  const { user, profile, refreshProfile } = useAuth()
  const [code, setCode] = useState('')
  const [codeMsg, setCodeMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const toast = useToast()
  const qc = useQueryClient()
  const { data: s, isLoading } = useQuery({
    queryKey: ['rewards', user?.id],
    enabled: !!supabase && !!user,
    queryFn: async () => { const { data, error } = await requireSupabase().rpc('my_referral_summary'); if (error) throw error; return data as unknown as Summary },
  })
  const { data: loyalty } = usePublicSetting<{ points_per_100_inr: number; paise_per_point: number; min_redeem_points: number }>('loyalty')
  const [pts, setPts] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  if (isLoading || !s) return <Skeleton className="h-64" />
  const applyCode = async () => {
    const { error } = await requireSupabase().rpc('apply_referral_code', { p_code: code })
    if (error) return setCodeMsg({ ok: false, text: friendlyError(error) })
    setCodeMsg({ ok: true, text: 'Code added. Your friend gets credit after your first order is delivered.' })
    setCode(''); await refreshProfile()
  }

  const link = `${location.origin}/?ref=${s.referral_code}`
  const need = s.campaign?.required_referrals ?? 5
  const progress = s.qualified % need
  const share = async () => {
    const text = `Shop electronics, fashion and more at Sanjaya Store. Free delivery on your first order: ${link}`
    try {
      if (navigator.share) await navigator.share({ title: 'Sanjaya Store', text, url: link })
      else { await navigator.clipboard.writeText(link); toast('Invite link copied') }
    } catch { /* cancelled */ }
  }
  const redeem = async () => {
    const n = Number(pts)
    if (!Number.isInteger(n) || n <= 0) return setErr('Enter a whole number of points.')
    setBusy(true); setErr(null)
    const { data, error } = await requireSupabase().rpc('redeem_points', { p_points: n })
    setBusy(false)
    if (error) return setErr(friendlyError(error))
    const r = data as { code: string; value_paise: number }
    toast(`Coupon ${r.code} worth ${formatINR(r.value_paise)} created`)
    setPts(''); qc.invalidateQueries({ queryKey: ['rewards'] })
  }

  return (
    <>
      <PageTitle title="Rewards" subtitle="Invite friends and earn points on every delivered order." />
      <section className="overflow-hidden rounded-2xl bg-navy-900 p-6 text-white">
        <div className="flex flex-wrap items-center gap-4">
          <Gift className="size-8 text-gold-300" />
          <div className="flex-1">
            <p className="font-display text-2xl font-semibold">{s.campaign?.headline ?? `Invite ${need} friends, get a free gift`}</p>
            <p className="text-sm text-white/70">{(s.campaign?.reward_description ?? 'A reward for every 5 friends').replace(/\.?$/, '.')} A friend counts once their first order is delivered.</p>
          </div>
        </div>
        <div className="mt-5 flex gap-1.5" aria-label={`${progress} of ${need} friends`}>
          {Array.from({ length: need }, (_, i) => <span key={i} className={`h-2 flex-1 rounded-full ${i < progress ? 'bg-gold-400' : 'bg-white/15'}`} />)}
        </div>
        <p className="mt-2 text-sm text-white/80">{progress} of {need} friends · {s.joined} joined with your link, {s.qualified} counted</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <code className="rounded-full bg-white/10 px-4 py-2 text-sm tracking-widest text-gold-200">{s.referral_code}</code>
          <Button variant="light" size="sm" onClick={share}><Share2 className="size-4" /> Share invite</Button>
          <Button variant="light" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(link); toast('Invite link copied') } catch { toast(link) } }}><Copy className="size-4" /> Copy link</Button>
        </div>
      </section>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 font-semibold text-navy-900">Your rewards</h2>
          {!s.rewards.length ? <p className="text-sm text-navy-600">No rewards yet. They appear here as soon as you earn them.</p> : (
            <ul className="space-y-2 text-sm">
              {s.rewards.map((r) => (
                <li key={r.milestone + (r.coupon_code ?? '')} className="flex flex-wrap items-center gap-2 rounded-xl border border-navy-100 p-3">
                  <Gift className="size-4 text-gold-700" />
                  {r.coupon_code ? <><code className="font-semibold">{r.coupon_code}</code><span>{r.coupon_value_paise ? formatINR(r.coupon_value_paise) + ' off' : ''}</span></> : <span>Free gift (our team will contact you)</span>}
                  <Badge tone={r.coupon_used ? 'grey' : 'green'} className="ml-auto">{r.coupon_used ? 'used' : r.status}</Badge>
                  {r.expires_at && !r.coupon_used && <span className="w-full text-xs text-navy-600">Use by {new Date(r.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                </li>
              ))}
            </ul>
          )}
          {s.friends.length > 0 && (
            <>
              <h3 className="mb-2 mt-5 text-sm font-semibold text-navy-900">Friends</h3>
              <ul className="space-y-1 text-sm">{s.friends.map((f, i) => <li key={i} className="flex justify-between"><span>{f.name}</span><Badge tone={f.status === 'qualified' ? 'green' : 'grey'}>{f.status === 'qualified' ? 'counted' : 'waiting for first delivery'}</Badge></li>)}</ul>
            </>
          )}
        </section>
        <section className="card p-5">
          <h2 className="mb-1 flex items-center gap-2 font-semibold text-navy-900"><Star className="size-5 text-gold-600" /> {s.points.toLocaleString('en-IN')} points</h2>
          {loyalty && <p className="text-sm text-navy-700">You earn {loyalty.points_per_100_inr} point per ₹100 on delivered orders. 1 point = {formatINR(loyalty.paise_per_point)}. Redeem from {loyalty.min_redeem_points} points for a coupon.</p>}
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <InputField label="Points to redeem" inputMode="numeric" value={pts} onChange={(e) => setPts(e.target.value.replace(/\D/g, ''))} className="min-w-40 flex-1" />
            <Button loading={busy} onClick={redeem} disabled={!pts}>Get coupon</Button>
          </div>
          {err && <div className="mt-3"><Alert tone="error">{err}</Alert></div>}
          {profile && (!profile.referred_by || codeMsg?.ok) && (
            <div className="mt-6 border-t border-navy-100 pt-4">
              <p className="text-sm font-semibold text-navy-900">Invited by a friend?</p>
              <p className="text-xs text-navy-600">Add their code before your first order.</p>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <InputField label="Friend's code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={16} className="min-w-40 flex-1" />
                <Button variant="outline" disabled={code.length < 4 || !!profile.referred_by} onClick={applyCode}>Add code</Button>
              </div>
              {codeMsg && <div className="mt-2"><Alert tone={codeMsg.ok ? 'success' : 'error'}>{codeMsg.text}</Alert></div>}
            </div>
          )}
        </section>
      </div>
    </>
  )
}
