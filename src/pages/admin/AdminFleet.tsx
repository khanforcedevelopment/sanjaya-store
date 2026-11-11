import { lazy, Suspense, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Bike, Car, Truck, UserPlus } from 'lucide-react'
import { Alert, Badge, Skeleton } from '@/components/ui/misc'
import { useToast } from '@/components/ui/Toast'
import { requireSupabase, friendlyError } from '@/lib/supabase'
import { emirateName } from '@/lib/emirates'
import { formatDay } from '@/lib/format'
import { STATUS_LABEL } from '@/lib/orderStatus'
import type { OrderStatus } from '@/lib/types'
import { cn } from '@/lib/cn'
import { AdminTitle, Panel, ProgressBar, Stat, Td } from './ui'

const FleetMap = lazy(() => import('@/features/delivery/FleetMap'))

export type RiderStatus = 'available' | 'on_route' | 'maintenance' | 'offline'
type Rider = {
  id: string; name: string; phone: string | null; vehicle_type: 'bike' | 'car' | 'van'; plate: string | null; status: RiderStatus
  lat: number | null; lng: number | null; seen_at: string | null; active: number; drops_today: number; delayed: boolean
  current: { order_id: string; order_number: string; status: OrderStatus; pincode: string; eta: string | null; is_delayed: boolean } | null
}
type Fleet = {
  warehouse: { warehouse_lat?: number; warehouse_lng?: number; warehouse_name?: string } | null
  riders: Rider[]
  pipeline: { placed: number; packed: number; dispatched: number; out_for_delivery: number; delivered_today: number }
  delivered_today: number; on_time_today: number; delayed: number; avg_delivery_minutes: number | null; unassigned: number
}

export const RIDER_STATUS: Record<RiderStatus, { label: string; color: string }> = {
  on_route: { label: 'On route', color: '#33c48a' },
  available: { label: 'Available', color: '#4c8dff' },
  maintenance: { label: 'Maintenance', color: '#f59f2f' },
  offline: { label: 'Offline', color: '#9a948d' },
}
const VEHICLE = { bike: Bike, car: Car, van: Truck }
/** Map colour: red when a delivery is late, otherwise the status colour. */
export const riderColor = (r: Pick<Rider, 'status' | 'delayed'>) => (r.delayed ? '#f0533a' : RIDER_STATUS[r.status].color)
/** Progress of the current order along the delivery steps. */
const STEP: Partial<Record<OrderStatus, number>> = { order_confirmed: 15, processing: 25, packed: 40, dispatched: 60, in_transit: 70, out_for_delivery: 85, delivery_failed: 85, delivered: 100 }

export function AdminFleet() {
  const qc = useQueryClient()
  const toast = useToast()
  const [filter, setFilter] = useState<'' | RiderStatus | 'delayed'>('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const { data: d, error } = useQuery({
    queryKey: ['admin', 'fleet'],
    refetchInterval: 15_000,
    queryFn: async () => { const { data, error } = await requireSupabase().rpc('admin_fleet'); if (error) throw error; return data as unknown as Fleet },
  })
  if (error) return <Alert tone="error">{friendlyError(error)}</Alert>

  const assign = async () => {
    setBusy(true); setErr(null)
    const { data, error } = await requireSupabase().rpc('admin_auto_assign')
    setBusy(false)
    if (error) { setErr(friendlyError(error)); return }
    const r = data as unknown as { order_number: string; rider_name: string | null }
    toast(`Order ${r.order_number} assigned to ${r.rider_name ?? 'rider'}`)
    qc.invalidateQueries({ queryKey: ['admin'] })
  }

  const riders = d?.riders ?? []
  const onRoute = riders.filter((r) => r.status === 'on_route').length
  const shown = riders.filter((r) => !filter || (filter === 'delayed' ? r.delayed : r.status === filter))
  const located = riders.filter((r) => r.lat != null && r.lng != null && r.status !== 'offline')
  const wh = { lat: d?.warehouse?.warehouse_lat ?? 25.2048, lng: d?.warehouse?.warehouse_lng ?? 55.2708, name: d?.warehouse?.warehouse_name ?? 'Warehouse' }
  const p = d?.pipeline
  const pipeTotal = p ? Math.max(1, p.placed + p.packed + p.dispatched + p.out_for_delivery + p.delivered_today) : 1
  const onTime = d && d.delivered_today ? Math.round((d.on_time_today / d.delivered_today) * 100) : null

  return (
    <>
      <AdminTitle title="Delivery fleet" subtitle="Riders, live locations and today's deliveries. Updates every 15 seconds.">
        <Link to="/admin/staff" className="pill pill-light"><UserPlus className="size-4" /> Add rider</Link>
        <button type="button" className="pill pill-dark" disabled={busy} onClick={assign}>{busy ? 'Assigning…' : 'Assign delivery'}</button>
      </AdminTitle>
      {err && <div className="mb-4"><Alert tone="error">{err}</Alert></div>}
      {!d ? <Skeleton className="h-[520px] rounded-[22px] bg-white/40" /> : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat green label="Active riders" value={`${onRoute} / ${riders.length}`} sub="on route / total" />
            <Stat label="Delivered today" value={d.delivered_today} sub={d.unassigned ? `${d.unassigned} orders waiting for a rider` : undefined} />
            <Stat label="On-time rate" value={onTime == null ? '—' : `${onTime}%`} sub={`${d.delayed} delayed`} tone={d.delayed ? 'warn' : undefined} />
            <Stat label="Avg. delivery time" value={d.avg_delivery_minutes == null ? '—' : `${d.avg_delivery_minutes} min`} sub="out for delivery → delivered, 7 days" />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
            <Panel title="Live map" action={
              <div className="flex flex-wrap gap-3 text-xs">
                {(['on_route', 'available', 'maintenance'] as RiderStatus[]).map((s) => <span key={s} className="inline-flex items-center gap-1"><span className="size-2.5 rounded-full" style={{ background: RIDER_STATUS[s].color }} />{RIDER_STATUS[s].label}</span>)}
                <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-full bg-[#f0533a]" />Delayed</span>
              </div>
            }>
              <Suspense fallback={<Skeleton className="h-[340px] bg-white/40 sm:h-[420px]" />}>
                <FleetMap warehouse={wh} riders={located.map((r) => ({ id: r.id, name: r.name, lat: r.lat!, lng: r.lng!, color: riderColor(r),
                  note: `${RIDER_STATUS[r.status].label}${r.current ? ` · ${r.current.order_number}` : ''}${r.seen_at ? ` · seen ${new Date(r.seen_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' })}` : ''}` }))} />
              </Suspense>
              {riders.length > 0 && located.length === 0 && <p className="mt-2 text-xs muted">No live positions yet. Riders appear when they open “My deliveries” on their phone and turn on location sharing.</p>}
            </Panel>

            <Panel title="Delivery pipeline" action={<span className="text-xs muted">Now</span>}>
              <ul className="space-y-3.5">
                {([['Order placed', p!.placed, '#141414'], ['Packed', p!.packed, '#f4c534'], ['Dispatched', p!.dispatched, '#4c8dff'],
                  ['Out for delivery', p!.out_for_delivery, '#f59f2f'], ['Delivered today', p!.delivered_today, '#33c48a']] as [string, number, string][]).map(([l, n, c]) => (
                  <li key={l}>
                    <div className="mb-1 flex justify-between text-sm"><span className="font-semibold">{l}</span><span className="font-bold">{n}</span></div>
                    <ProgressBar value={(n / pipeTotal) * 100} color={c} label={l} />
                  </li>
                ))}
              </ul>
              {d.delayed > 0 && (
                <Link to="/admin/orders?delayed=1" className="mt-4 flex items-start gap-2 rounded-2xl bg-[#f0533a] p-3 text-sm text-white">
                  <AlertTriangle className="mt-0.5 size-4 flex-none" />
                  <span><strong>{d.delayed} late {d.delayed === 1 ? 'delivery' : 'deliveries'}.</strong> Open them and tell the customer the new date.</span>
                </Link>
              )}
            </Panel>
          </div>

          <Panel title="Riders & vehicles" action={
            <div className="scrollbar-none flex gap-1 overflow-x-auto">
              {([['', 'All'], ['on_route', 'On route'], ['available', 'Available'], ['maintenance', 'Maintenance'], ['offline', 'Offline'], ['delayed', 'Delayed']] as [typeof filter, string][]).map(([v, l]) => (
                <button key={v} type="button" onClick={() => setFilter(v)} className={cn('pill !h-8 !px-3 text-xs', filter === v ? 'pill-on' : 'pill-ghost')}>{l}</button>
              ))}
            </div>
          }>
            {!riders.length ? (
              <div className="py-8 text-center text-sm">
                <p className="font-semibold">No riders yet.</p>
                <p className="muted">Give a staff member the “delivery” role in Staff. They then see “My deliveries” and can share their location.</p>
              </div>
            ) : (
              <div className="card overflow-x-auto">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead className="border-b text-xs uppercase tracking-wider muted">
                    <tr>{['Rider', 'Vehicle', 'Status', 'Current order', 'Area', 'Progress', 'ETA', 'Drops today'].map((h) => <th key={h} className="px-3 py-2.5 font-semibold">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y">{shown.map((r) => <RiderRow key={r.id} r={r} />)}</tbody>
                </table>
                {!shown.length && <p className="p-6 text-center text-sm muted">No riders with this status.</p>}
              </div>
            )}
          </Panel>
        </div>
      )}
    </>
  )
}

function RiderRow({ r }: { r: Rider }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [edit, setEdit] = useState(false)
  const [vehicle, setVehicle] = useState(r.vehicle_type)
  const [plate, setPlate] = useState(r.plate ?? '')
  const Icon = VEHICLE[r.vehicle_type]
  const save = async (patch: { p_status?: RiderStatus; p_vehicle?: string; p_plate?: string }) => {
    const { error } = await requireSupabase().rpc('admin_update_rider', { p_rider: r.id, ...patch })
    if (error) toast(friendlyError(error)); else { setEdit(false); qc.invalidateQueries({ queryKey: ['admin', 'fleet'] }) }
  }
  return (
    <tr>
      <Td><p className="font-semibold">{r.name}</p>{r.phone && <a href={`tel:${r.phone}`} className="text-xs muted hover:underline">{r.phone}</a>}</Td>
      <Td>
        {edit ? (
          <div className="flex gap-1">
            <select className="input h-8 w-auto py-0 text-xs" value={vehicle} onChange={(e) => setVehicle(e.target.value as Rider['vehicle_type'])} aria-label="Vehicle type">
              <option value="bike">Bike</option><option value="car">Car</option><option value="van">Van</option>
            </select>
            <input className="input h-8 w-24 text-xs" value={plate} maxLength={20} onChange={(e) => setPlate(e.target.value.toUpperCase())} placeholder="Plate" aria-label="Plate number" />
            <button type="button" className="pill pill-dark !h-8 !px-3 text-xs" onClick={() => save({ p_vehicle: vehicle, p_plate: plate })}>Save</button>
          </div>
        ) : (
          <button type="button" className="inline-flex items-center gap-1.5 hover:underline" onClick={() => setEdit(true)} aria-label="Edit vehicle">
            <Icon className="size-4" /> <span className="capitalize">{r.vehicle_type}</span>{r.plate && <span className="text-xs muted">· {r.plate}</span>}
          </button>
        )}
      </Td>
      <Td>
        <select className="input h-8 w-auto py-0 text-xs font-semibold" style={{ color: RIDER_STATUS[r.status].color === '#9a948d' ? undefined : RIDER_STATUS[r.status].color }}
          value={r.status} onChange={(e) => save({ p_status: e.target.value as RiderStatus })} aria-label={`${r.name} status`}>
          {(Object.keys(RIDER_STATUS) as RiderStatus[]).map((s) => <option key={s} value={s}>{RIDER_STATUS[s].label}</option>)}
        </select>
        {r.delayed && <Badge tone="red" className="ml-1">Delayed</Badge>}
      </Td>
      <Td>{r.current ? <Link to={`/admin/orders/${r.current.order_id}`} className="font-semibold hover:underline">{r.current.order_number}</Link> : <span className="muted">—</span>}
        {r.current && <span className="block text-xs muted">{STATUS_LABEL[r.current.status]}{r.active > 1 ? ` · +${r.active - 1} more` : ''}</span>}</Td>
      <Td>{r.current ? emirateName(r.current.pincode) : '—'}</Td>
      <Td className="w-36">{r.current ? <ProgressBar value={STEP[r.current.status] ?? 10} color={riderColor(r)} label="Delivery progress" /> : <span className="muted">—</span>}</Td>
      <Td>{r.current?.eta ? formatDay(r.current.eta) : '—'}</Td>
      <Td className="font-bold">{r.drops_today}</Td>
    </tr>
  )
}
