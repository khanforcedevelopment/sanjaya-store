import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert } from '@/components/ui/misc'
import { Button } from '@/components/ui/Button'
import { InputField, SelectField } from '@/components/ui/Field'
import { requireSupabase, friendlyError } from '@/lib/supabase'
import { AdminTitle, Table, Td, rupeesInput } from './ui'

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
  const [pin, setPin] = useState({ pincode: '', zone_id: '', city: '', state: '', is_serviceable: true })

  return (
    <>
      <AdminTitle title="Delivery zones" subtitle="Days are counted from dispatch. Leave the fee empty to use the standard fee from Settings." />
      {err && <div className="mb-3"><Alert tone="error">{err}</Alert></div>}
      <Table head={['Zone', 'Min days', 'Max days', 'Fee ₹', 'Remote', 'Active']}>
        {zones?.map((z) => (
          <tr key={z.id}>
            <Td><span className="font-semibold">{z.name}</span><span className="block text-xs text-navy-600">{z.code}</span></Td>
            <Td><input className="input h-8 w-20" defaultValue={z.min_days} inputMode="numeric" aria-label="Min days" onBlur={(e) => { const n = parseInt(e.target.value, 10); if (n >= 0 && n !== z.min_days) run(db.from('delivery_zones').update({ min_days: n }).eq('id', z.id)) }} /></Td>
            <Td><input className="input h-8 w-20" defaultValue={z.max_days} inputMode="numeric" aria-label="Max days" onBlur={(e) => { const n = parseInt(e.target.value, 10); if (n >= 0 && n !== z.max_days) run(db.from('delivery_zones').update({ max_days: n }).eq('id', z.id)) }} /></Td>
            <Td><input className="input h-8 w-24" defaultValue={z.fee_override_paise != null ? z.fee_override_paise / 100 : ''} placeholder="standard" inputMode="decimal" aria-label="Fee" onBlur={(e) => { const v = e.target.value ? rupeesInput(e.target.value) : null; if (v !== z.fee_override_paise) run(db.from('delivery_zones').update({ fee_override_paise: v }).eq('id', z.id)) }} /></Td>
            <Td><input type="checkbox" className="size-4 accent-gold-500" checked={z.is_remote} onChange={(e) => run(db.from('delivery_zones').update({ is_remote: e.target.checked }).eq('id', z.id))} aria-label="Remote" /></Td>
            <Td><input type="checkbox" className="size-4 accent-gold-500" checked={z.is_active} onChange={(e) => run(db.from('delivery_zones').update({ is_active: e.target.checked }).eq('id', z.id))} aria-label="Active" /></Td>
          </tr>
        ))}
      </Table>

      <h2 className="mb-2 mt-8 font-display text-2xl font-semibold text-navy-900">Pincode exceptions</h2>
      <p className="mb-3 text-sm text-navy-700">Pincodes listed here override the automatic zone. Untick “We deliver” to block a pincode.</p>
      <form className="card mb-3 grid gap-3 p-4 sm:grid-cols-6" onSubmit={(e) => {
        e.preventDefault()
        if (!/^[1-9][0-9]{5}$/.test(pin.pincode) || !pin.zone_id) return setErr('Enter a 6-digit pincode and choose a zone.')
        run(db.from('pincodes').upsert({ ...pin, city: pin.city || null, state: pin.state || null }))
        setPin({ ...pin, pincode: '', city: '' })
      }}>
        <InputField label="Pincode" inputMode="numeric" maxLength={6} value={pin.pincode} onChange={(e) => setPin({ ...pin, pincode: e.target.value.replace(/\D/g, '') })} />
        <SelectField label="Zone" value={pin.zone_id} onChange={(e) => setPin({ ...pin, zone_id: e.target.value })}><option value="">Choose…</option>{zones?.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</SelectField>
        <InputField label="City" value={pin.city} onChange={(e) => setPin({ ...pin, city: e.target.value })} />
        <InputField label="State" value={pin.state} onChange={(e) => setPin({ ...pin, state: e.target.value })} />
        <label className="flex items-end gap-2 pb-3 text-sm"><input type="checkbox" className="size-4 accent-gold-500" checked={pin.is_serviceable} onChange={(e) => setPin({ ...pin, is_serviceable: e.target.checked })} /> We deliver</label>
        <div className="flex items-end"><Button type="submit" size="sm">Save pincode</Button></div>
      </form>
      <Table head={['Pincode', 'Zone', 'City', 'Delivers', '']} empty={!pins?.length}>
        {pins?.map((p) => (
          <tr key={p.pincode}>
            <Td className="font-mono">{p.pincode}</Td><Td>{(p.zone as { name: string } | null)?.name}</Td><Td>{p.city}{p.state ? `, ${p.state}` : ''}</Td>
            <Td><input type="checkbox" className="size-4 accent-gold-500" checked={p.is_serviceable} onChange={(e) => run(db.from('pincodes').update({ is_serviceable: e.target.checked }).eq('pincode', p.pincode))} aria-label="Delivers" /></Td>
            <Td><button className="text-xs text-danger" onClick={() => run(db.from('pincodes').delete().eq('pincode', p.pincode))}>Remove</button></Td>
          </tr>
        ))}
      </Table>
    </>
  )
}
