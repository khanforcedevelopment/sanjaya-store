import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Clock, KeyRound, MapPin, Truck, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { PageTitle, Skeleton } from '@/components/ui/misc'
import { usePincodeCheck, usePublicSetting } from '@/features/catalog/api'
import { usePincode } from '@/features/delivery/usePincode'
import { requireSupabase, supabase } from '@/lib/supabase'
import { formatINR } from '@/lib/money'
import { formatDeliveryWindow } from '@/lib/format'
import { useDocumentMeta } from '@/lib/meta'

function useZones() {
  return useQuery({
    queryKey: ['zones'],
    enabled: !!supabase,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('delivery_zones').select('code, name, min_days, max_days, is_remote, fee_override_paise').eq('is_active', true).order('sort_order')
      if (error) throw error
      return data
    },
  })
}

export function DeliveryPage() {
  useDocumentMeta({ title: 'Delivery & pincodes', description: 'Check delivery to your pincode. Free delivery on your first order, then ₹50. Dispatched from Mumbai by our own team.' })
  const { pincode, setPincode } = usePincode()
  const [draft, setDraft] = useState(pincode ?? '')
  const { data: check, isFetching } = usePincodeCheck(pincode)
  const { data: zones, isLoading } = useZones()
  const { data: delivery } = usePublicSetting<{ default_fee_paise?: number; first_order_free?: boolean }>('delivery')
  const fee = delivery?.default_fee_paise ?? 5000

  const submit = (e: FormEvent) => { e.preventDefault(); if (/^[1-9][0-9]{5}$/.test(draft)) setPincode(draft) }

  return (
    <div className="container-x max-w-4xl py-10">
      <PageTitle title="Delivery & pincodes" subtitle="Every order is packed and dispatched from Mumbai and delivered by our own team or partners." />

      <form onSubmit={submit} className="card flex flex-wrap items-end gap-3 p-5">
        <div className="min-w-48 flex-1">
          <label htmlFor="pin" className="label">Check your pincode</label>
          <input id="pin" className="input" inputMode="numeric" maxLength={6} placeholder="e.g. 400050" value={draft} onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))} />
        </div>
        <Button type="submit" loading={isFetching}>Check</Button>
        {pincode && check && (
          <div className="w-full text-sm">
            {check.serviceable ? (
              <p className="flex items-start gap-2 text-success"><CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                <span>We deliver to {pincode}{check.city ? ` (${check.city})` : ''}: {check.zone_name}, usually {check.min_days}–{check.max_days} days{check.estimated_min_date ? `, arriving ${formatDeliveryWindow(check.estimated_min_date, check.estimated_max_date)} if you order today` : ''}.</span></p>
            ) : (
              <p className="flex items-start gap-2 text-danger"><XCircle className="mt-0.5 size-4 shrink-0" /> Sorry, we do not deliver to {pincode} yet.</p>
            )}
          </div>
        )}
      </form>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Info icon={<Truck />} title={delivery?.first_order_free === false ? `${formatINR(fee)} delivery` : 'First delivery free'}>
          {delivery?.first_order_free === false ? 'Flat fee on every order.' : `Your first eligible order ships free. After that, delivery is a flat ${formatINR(fee)} per order.`}
        </Info>
        <Info icon={<KeyRound />} title="Delivery code">You get a 4-digit code when your order is dispatched. Share it with the rider only when you receive the parcel.</Info>
        <Info icon={<MapPin />} title="Pin on the map">Add a map pin to your address (optional) so the rider reaches your door faster.</Info>
      </div>

      <h2 className="mt-10 font-display text-2xl font-semibold text-navy-900">Delivery times</h2>
      <p className="mt-1 text-sm text-navy-700">Counted in days from dispatch, after our team approves your order. Sundays and public holidays can add a day.</p>
      <div className="card mt-4 overflow-hidden">
        {isLoading ? <Skeleton className="h-40" /> : (
          <table className="w-full text-left text-sm">
            <thead className="bg-navy-900 text-white"><tr><th className="px-4 py-3 font-semibold">Area</th><th className="px-4 py-3 font-semibold">Usually arrives in</th><th className="px-4 py-3 font-semibold">Fee</th></tr></thead>
            <tbody className="divide-y divide-navy-100">
              {zones?.map((z) => (
                <tr key={z.code}>
                  <td className="px-4 py-3 font-medium text-navy-900">{z.name}</td>
                  <td className="px-4 py-3"><span className="inline-flex items-center gap-1"><Clock className="size-3.5 text-gold-600" /> {z.min_days}–{z.max_days} days</span></td>
                  <td className="px-4 py-3">{formatINR(z.fee_override_paise ?? fee)}{delivery?.first_order_free !== false && <span className="text-xs text-success"> · first order free</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function Info({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <span className="text-gold-600 [&_svg]:size-6">{icon}</span>
      <p className="mt-3 font-semibold text-navy-900">{title}</p>
      <p className="mt-1 text-sm text-navy-700">{children}</p>
    </div>
  )
}
