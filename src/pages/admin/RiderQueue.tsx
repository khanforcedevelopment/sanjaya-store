import { emirateName } from '@/lib/emirates'
import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, LocateFixed, MapPin, Phone } from 'lucide-react'
import { Alert, Badge, EmptyState } from '@/components/ui/misc'
import { Button } from '@/components/ui/Button'
import { InputField, SelectField } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { formatAED } from '@/lib/money'
import { STATUS_LABEL, statusTone } from '@/lib/orderStatus'
import { requireSupabase, friendlyError } from '@/lib/supabase'
import type { Database } from '@/types/database'
import { AdminTitle } from './ui'

type Stop = Database['public']['Functions']['my_delivery_queue']['Returns'][number]
type Addr = { recipient_name?: string; phone?: string; house?: string; street?: string; landmark?: string; city?: string; state?: string; pincode?: string }

const FAIL_REASONS = [
  { v: 'customer_unavailable', l: 'Customer not available' },
  { v: 'address_issue', l: 'Could not find the address' },
  { v: 'refused', l: 'Customer refused the parcel' },
  { v: 'rescheduled', l: 'Customer asked for another day' },
  { v: 'other', l: 'Other' },
]

function StopCard({ s }: { s: Stop }) {
  const db = requireSupabase()
  const qc = useQueryClient()
  const toast = useToast()
  const a = (s.shipping_address ?? {}) as Addr
  const [mode, setMode] = useState<'none' | 'deliver' | 'fail'>('none')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [recipient, setRecipient] = useState(a.recipient_name ?? '')
  const [code, setCode] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [reason, setReason] = useState('customer_unavailable')
  const [note, setNote] = useState('')
  const [date, setDate] = useState('')
  const due = s.total_paise - s.amount_paid_paise
  const done = (msg: string) => { setErr(null); setMode('none'); toast(msg); qc.invalidateQueries({ queryKey: ['rider'] }) }

  const start = async () => {
    setBusy(true)
    const { error } = await db.rpc('transition_order', { p_order: s.order_id, p_to: 'out_for_delivery', p_note: 'Out for delivery', p_customer_visible: true })
    setBusy(false)
    if (error) setErr(friendlyError(error)); else { db.rpc('rider_set_status', { p_status: 'on_route' }).then(() => undefined); done('Marked out for delivery') }
  }

  const deliver = async () => {
    if (!/^\d{4}$/.test(code)) { setErr('Enter the 4-digit code from the customer.'); return }
    if (!recipient.trim()) { setErr('Enter who received the parcel.'); return }
    setBusy(true)
    let path: string | undefined
    if (photo) {
      if (photo.size > 8 * 1024 * 1024) { setBusy(false); setErr('Photo is too large (max 8 MB).'); return }
      const ext = (photo.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
      path = `${s.order_id}/${Date.now()}.${ext}`
      const up = await db.storage.from('delivery-proofs').upload(path, photo, { contentType: photo.type || 'image/jpeg' })
      if (up.error) { setBusy(false); setErr(friendlyError(up.error)); return }
    }
    const { error } = await db.rpc('complete_delivery', { p_order: s.order_id, p_recipient_name: recipient.trim(), p_delivery_code: code, p_photo_path: path })
    setBusy(false)
    if (error) setErr(friendlyError(error)); else done(`Order ${s.order_number} delivered`)
  }

  const fail = async () => {
    if (reason === 'rescheduled' && !date) { setErr('Pick the new delivery date.'); return }
    setBusy(true)
    const { error } = await db.rpc('record_delivery_attempt', { p_order: s.order_id, p_outcome: reason, p_note: note || undefined, p_rescheduled_for: date || undefined })
    setBusy(false)
    if (error) setErr(friendlyError(error)); else done('Attempt recorded')
  }

  const mapUrl = s.latitude != null && s.longitude != null
    ? `https://www.google.com/maps/search/?api=1&query=${s.latitude},${s.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([a.house, a.street, a.city, emirateName(a.pincode) || a.state, 'UAE'].filter(Boolean).join(', '))}`
  const canStart = s.status === 'dispatched' || s.status === 'in_transit' || s.status === 'delivery_failed'
  const onRoad = s.status === 'out_for_delivery'

  return (
    <article className="card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold text-navy-900">#{s.order_number}</p>
        <Badge tone={statusTone(s.status)}>{STATUS_LABEL[s.status]}</Badge>
        {s.is_delayed && <Badge tone="red">Delayed</Badge>}
        {s.scheduled_date && <span className="ml-auto text-xs text-navy-600">Planned {new Date(s.scheduled_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
      </div>
      <p className="mt-2 font-medium">{a.recipient_name}</p>
      <p className="text-sm text-navy-700">{[a.house, a.street].filter(Boolean).join(', ')}{a.landmark ? `, near ${a.landmark}` : ''}<br />{a.city}, {emirateName(a.pincode) || a.state}</p>
      <p className="mt-1 text-sm">{s.items} item{s.items === 1 ? '' : 's'} · {due > 0 ? <strong className="text-danger">Collect {formatAED(due)}</strong> : <span className="text-success">Prepaid</span>}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {a.phone && <a className="inline-flex h-9 items-center gap-1.5 rounded-full border border-navy-900/15 px-4 text-sm font-semibold" href={`tel:${a.phone}`}><Phone className="size-4" /> Call</a>}
        <a className="inline-flex h-9 items-center gap-1.5 rounded-full border border-navy-900/15 px-4 text-sm font-semibold" href={mapUrl} target="_blank" rel="noreferrer"><MapPin className="size-4" /> Map</a>
        {canStart && <Button size="sm" variant="navy" loading={busy} onClick={start}>Start delivery</Button>}
        {onRoad && <Button size="sm" onClick={() => setMode('deliver')}>Delivered</Button>}
        {onRoad && <Button size="sm" variant="outline" onClick={() => setMode('fail')}>Could not deliver</Button>}
      </div>
      {err && <div className="mt-3"><Alert tone="error">{err}</Alert></div>}
      {mode === 'deliver' && (
        <div className="mt-4 grid gap-3 rounded-xl bg-navy-50/60 p-3 sm:grid-cols-2">
          <InputField label="4-digit code from customer" inputMode="numeric" maxLength={4} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          <InputField label="Received by" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
          <label className="flex cursor-pointer items-center gap-2 text-sm sm:col-span-2">
            <Camera className="size-4" /> {photo ? photo.name : 'Add a photo of the parcel at the door (optional)'}
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          </label>
          <div className="flex gap-2 sm:col-span-2"><Button size="sm" loading={busy} onClick={deliver}>Confirm delivery</Button><Button size="sm" variant="ghost" onClick={() => setMode('none')}>Cancel</Button></div>
        </div>
      )}
      {mode === 'fail' && (
        <div className="mt-4 grid gap-3 rounded-xl bg-navy-50/60 p-3 sm:grid-cols-2">
          <SelectField label="What happened" value={reason} onChange={(e) => setReason(e.target.value)}>
            {FAIL_REASONS.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
          </SelectField>
          {reason === 'rescheduled' && <InputField label="New date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
          <InputField label="Note (optional)" className="sm:col-span-2" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-2 sm:col-span-2"><Button size="sm" variant="navy" loading={busy} onClick={fail}>Save attempt</Button><Button size="sm" variant="ghost" onClick={() => setMode('none')}>Cancel</Button></div>
        </div>
      )}
    </article>
  )
}

const STATUSES: [string, string][] = [['available', 'Available'], ['on_route', 'On route'], ['maintenance', 'Vehicle issue'], ['offline', 'Off duty']]

/** Sends the rider's GPS position every ~15 seconds while sharing is on and this page is open. */
function LocationShare() {
  const db = requireSupabase()
  const qc = useQueryClient()
  const [on, setOn] = useState(() => { try { return localStorage.getItem('rider-share') === '1' } catch { return false } })
  const [msg, setMsg] = useState<string | null>(null)
  const last = useRef(0)
  const { data: me } = useQuery({
    queryKey: ['rider', 'me'],
    queryFn: async () => { const { data } = await db.from('rider_profiles').select('status, vehicle_type, plate').maybeSingle(); return data },
  })
  useEffect(() => {
    try { localStorage.setItem('rider-share', on ? '1' : '0') } catch { /* private mode */ }
    if (!on) return
    if (!('geolocation' in navigator)) return
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        if (Date.now() - last.current < 14_000) return
        last.current = Date.now()
        db.rpc('rider_ping', { p_lat: pos.coords.latitude, p_lng: pos.coords.longitude, p_accuracy: pos.coords.accuracy })
          .then(({ error }) => setMsg(error ? friendlyError(error) : `Location shared at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`))
      },
      (e) => setMsg(e.code === e.PERMISSION_DENIED ? 'Location is blocked. Allow location for this site in your phone settings.' : 'Waiting for GPS…'),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [on, db])
  const setStatus = async (s: string) => {
    const { error } = await db.rpc('rider_set_status', { p_status: s })
    if (error) setMsg(friendlyError(error)); else qc.invalidateQueries({ queryKey: ['rider', 'me'] })
  }
  return (
    <section className="card mb-4 flex flex-wrap items-center gap-3 p-4">
      <button type="button" onClick={() => setOn(!on)} className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold ${on ? 'bg-[#0f8f62] text-white' : 'bg-[#141414] text-white'}`} aria-pressed={on}>
        <LocateFixed className="size-4" /> {on ? 'Sharing live location' : 'Share live location'}
      </button>
      <label className="flex items-center gap-2 text-sm">My status
        <select className="input h-10 w-auto py-0 text-sm" value={me?.status ?? 'offline'} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <p className="w-full text-xs text-navy-700/80 sm:w-auto">{on && !('geolocation' in navigator) ? 'This phone cannot share location.' : msg ?? 'Keep this page open while you deliver so operations can see you on the map.'}</p>
    </section>
  )
}

export function RiderQueue() {
  const db = requireSupabase()
  const { data, error, isLoading } = useQuery({
    queryKey: ['rider', 'queue'],
    queryFn: async () => { const { data, error } = await db.rpc('my_delivery_queue'); if (error) throw error; return data },
    refetchInterval: 60_000,
  })
  return (
    <>
      <AdminTitle title="My deliveries" subtitle="Ask the customer for the 4-digit code in their order before you hand over the parcel." />
      <LocationShare />
      {error && <Alert tone="error">{friendlyError(error)}</Alert>}
      {!isLoading && data?.length === 0 && <EmptyState title="No deliveries assigned">New orders appear here when operations assigns them to you.</EmptyState>}
      <div className="grid gap-4 lg:grid-cols-2">{data?.map((s) => <StopCard key={s.order_id} s={s} />)}</div>
    </>
  )
}
