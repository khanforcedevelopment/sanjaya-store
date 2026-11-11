import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert } from '@/components/ui/misc'
import { EMIRATES } from '@/lib/emirates'
import { requireSupabase, friendlyError } from '@/lib/supabase'
import { AdminTitle, Table, Td, aedInput } from './ui'

export function AdminDelivery() {
  const qc = useQueryClient()
  const db = requireSupabase()
  const [err, setErr] = useState<string | null>(null)
  const { data: zones } = useQuery({
    queryKey: ['admin', 'zones'],
    queryFn: async () => { const { data, error } = await db.from('delivery_zones').select('*').order('sort_order'); if (error) throw error; return data },
  })
  const { data: pins } = useQuery({
    queryKey: ['admin', 'pincodes'],
    queryFn: async () => { const { data, error } = await db.from('pincodes').select('*, zone:delivery_zones(name)').order('pincode').limit(500); if (error) throw error; return data },
  })
  const run = async (p: PromiseLike<{ error: unknown }>) => { const { error } = await p; if (error) setErr(friendlyError(error)); else { setErr(null); qc.invalidateQueries({ queryKey: ['admin'] }); qc.invalidateQueries({ queryKey: ['zones'] }) } }

  return (
    <>
      <AdminTitle title="Delivery zones" subtitle="Days are counted from dispatch. Leave the fee empty to use the standard fee from Settings." />
      {err && <div className="mb-3"><Alert tone="error">{err}</Alert></div>}
      <Table head={['Zone', 'Min days', 'Max days', 'Fee AED', 'Remote', 'Active']}>
        {zones?.map((z) => (
          <tr key={z.id}>
            <Td><span className="font-semibold">{z.name}</span><span className="block text-xs text-navy-600">{z.code}</span></Td>
            <Td><input className="input h-8 w-20" defaultValue={z.min_days} inputMode="numeric" aria-label="Min days" onBlur={(e) => { const n = parseInt(e.target.value, 10); if (n >= 0 && n !== z.min_days) run(db.from('delivery_zones').update({ min_days: n }).eq('id', z.id)) }} /></Td>
            <Td><input className="input h-8 w-20" defaultValue={z.max_days} inputMode="numeric" aria-label="Max days" onBlur={(e) => { const n = parseInt(e.target.value, 10); if (n >= 0 && n !== z.max_days) run(db.from('delivery_zones').update({ max_days: n }).eq('id', z.id)) }} /></Td>
            <Td><input className="input h-8 w-24" defaultValue={z.fee_override_paise != null ? z.fee_override_paise / 100 : ''} placeholder="standard" inputMode="decimal" aria-label="Fee" onBlur={(e) => { const v = e.target.value ? aedInput(e.target.value) : null; if (v !== z.fee_override_paise) run(db.from('delivery_zones').update({ fee_override_paise: v }).eq('id', z.id)) }} /></Td>
            <Td><input type="checkbox" className="size-4 accent-gold-500" checked={z.is_remote} onChange={(e) => run(db.from('delivery_zones').update({ is_remote: e.target.checked }).eq('id', z.id))} aria-label="Remote" /></Td>
            <Td><input type="checkbox" className="size-4 accent-gold-500" checked={z.is_active} onChange={(e) => run(db.from('delivery_zones').update({ is_active: e.target.checked }).eq('id', z.id))} aria-label="Active" /></Td>
          </tr>
        ))}
      </Table>

      <h2 className="mb-2 mt-8 font-display text-2xl font-semibold text-navy-900">Emirates</h2>
      <p className="mb-3 text-sm text-navy-700">Choose which zone each emirate belongs to. Untick “We deliver” to stop taking orders for an emirate.</p>
      <Table head={['Emirate', 'Zone', 'Delivers']} empty={!pins?.length}>
        {EMIRATES.map((e) => {
          const p = pins?.find((x) => x.pincode === e.code)
          const save = (patch: { zone_id?: string; is_serviceable?: boolean }) => {
            const zone_id = patch.zone_id ?? p?.zone_id ?? zones?.find((z) => z.is_active)?.id
            if (!zone_id) return setErr('Create a delivery zone first.')
            run(db.from('pincodes').upsert({ pincode: e.code, city: e.name, state: e.name, zone_id, is_serviceable: patch.is_serviceable ?? p?.is_serviceable ?? true }))
          }
          return (
            <tr key={e.code}>
              <Td><span className="font-semibold">{e.name}</span><span className="block font-mono text-xs text-navy-600">{e.code}</span></Td>
              <Td>
                <select className="input h-8" aria-label={`Zone for ${e.name}`} value={p?.zone_id ?? ''} onChange={(ev) => ev.target.value && save({ zone_id: ev.target.value })}>
                  <option value="">Not set</option>
                  {zones?.map((z) => <option key={z.id} value={z.id}>{z.name}{z.is_active ? '' : ' (off)'}</option>)}
                </select>
              </Td>
              <Td><input type="checkbox" className="size-4 accent-gold-500" checked={!!p?.is_serviceable} onChange={(ev) => save({ is_serviceable: ev.target.checked })} aria-label={`Deliver to ${e.name}`} /></Td>
            </tr>
          )
        })}
      </Table>
    </>
  )
}
