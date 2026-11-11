import { localUaeMobile } from '@/lib/phone'
import { emirateName } from '@/lib/emirates'
import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { CalendarClock, CreditCard, MapPin, Plus, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Alert, Badge, PageTitle, Skeleton } from '@/components/ui/misc'
import { TextareaField } from '@/components/ui/Field'
import { useAuth } from '@/features/account/AuthProvider'
import { AddressForm } from '@/features/account/AddressForm'
import { emptyAddress, formatAddressLines, useAddresses, useSaveAddress, type Address, type AddressValues } from '@/features/account/addresses'
import { useCart } from '@/features/cart/CartProvider'
import { toLines } from '@/features/cart/cartStore'
import { useQuote } from '@/features/cart/useQuote'
import { OrderSummary } from '@/features/cart/OrderSummary'
import { requireSupabase, friendlyError } from '@/lib/supabase'
import { startPayment } from '@/features/payments/startPayment'
import { formatAED } from '@/lib/money'
import { useDocumentMeta } from '@/lib/meta'
import type { AddressInput, PlacedOrder } from '@/lib/types'
import { cn } from '@/lib/cn'
import { reasonLink, useInstallmentSettings, useMyEligibility } from '@/features/installments/api'
import { AgreementText } from '@/features/installments/Agreement'

export function CheckoutPage() {
  useDocumentMeta({ title: 'Checkout', noindex: true })
  const { user, profile } = useAuth()
  const { items, coupon, setCoupon, clear } = useCart()
  const { data: addresses, isLoading: addrLoading } = useAddresses(user?.id)
  const saveAddress = useSaveAddress(user?.id)
  const navigate = useNavigate()
  const [picked, setPicked] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const selected: Address | undefined = addresses?.find((a) => a.id === picked) ?? addresses?.find((a) => a.is_default) ?? addresses?.[0]
  const lines = toLines(items)
  const quote = useQuote(lines, selected?.pincode, coupon, user?.id)
  const q = quote.data
  const { data: inst } = useInstallmentSettings()
  const { data: elig } = useMyEligibility(!!user)
  const [mode, setMode] = useState<'full' | 'installment'>('full')
  const [agreed, setAgreed] = useState(false)
  const schedule = q?.installment.schedule_paise ?? null
  // Show the option only when installments are on and every item in the bag allows them
  const firstPay = schedule?.[0] ?? 0
  const laterPay = schedule?.[schedule.length - 1] ?? 0
  const offerInstallments = !!(inst?.enabled && q?.installment.products_eligible && schedule)
  const amountReasons = q && inst ? [
    q.total_paise < inst.min_order_total_paise ? `Order must be at least ${formatAED(inst.min_order_total_paise)}` : null,
    inst.max_order_total_paise && q.total_paise > inst.max_order_total_paise ? `Order must be at most ${formatAED(inst.max_order_total_paise)}` : null,
  ].filter((r): r is string => !!r) : []
  const instReasons = [...(elig?.reasons ?? []), ...amountReasons]
  const canInstall = offerInstallments && !!elig?.eligible && amountReasons.length === 0
  const useInst = mode === 'installment' && canInstall
  const payNow = q ? (useInst ? firstPay : q.total_paise) : 0

  const place = useMutation({
    mutationFn: async (a: Address) => {
      const address: AddressInput = {
        recipient_name: a.recipient_name, phone: a.phone, house: a.house, street: a.street, landmark: a.landmark,
        city: a.city, state: a.state, pincode: a.pincode, latitude: a.latitude, longitude: a.longitude,
        location_source: a.location_source as 'manual' | 'gps',
      }
      const { data, error } = await requireSupabase().rpc('place_order', {
        p_items: lines as never, p_address: address as never, p_coupon_code: coupon || undefined,
        p_payment_mode: useInst ? 'installment' : 'full', p_customer_note: note.trim() || undefined,
        p_agreement_version: useInst ? inst?.agreement_version : undefined,
      })
      if (error) throw error
      return data as unknown as PlacedOrder
    },
    onSuccess: async (o) => {
      clear()
      // Go straight to Stripe; if that fails the order page offers "Pay now" again.
      try { await startPayment(o.order_id) } catch { navigate(`/order/${o.order_id}?payment=retry`, { replace: true }) }
    },
    onError: (e) => setError(friendlyError(e)),
  })

  if (!items.length && !place.isSuccess) return <Navigate to="/cart" replace />

  const showForm = adding || (!addrLoading && !addresses?.length)
  const onNewAddress = (values: AddressValues) => {
    setError(null)
    saveAddress.mutate({ values: { ...values, is_default: values.is_default || !addresses?.length } }, {
      onSuccess: (id) => { setPicked(id); setAdding(false) }, onError: (e) => setError(friendlyError(e)),
    })
  }
  const blocked = (useInst && !agreed) || !selected || !q || !!q.errors.length || !q.delivery.serviceable || !!(coupon && q.coupon.error)

  return (
    <div className="container-x py-8">
      <PageTitle title="Checkout" />
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          <section className="card p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-navy-900"><MapPin className="size-5 text-gold-600" /> Delivery address</h2>
            {addrLoading ? <Skeleton className="h-28" /> : showForm ? (
              <AddressForm busy={saveAddress.isPending} submitLabel="Use this address"
                initial={{ ...emptyAddress, recipient_name: profile?.full_name ?? '', phone: localUaeMobile(profile?.phone) }}
                onCancel={addresses?.length ? () => setAdding(false) : undefined} onSubmit={onNewAddress} />
            ) : (
              <>
                <ul className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Saved addresses">
                  {addresses!.map((a) => (
                    <li key={a.id}>
                      <button type="button" role="radio" aria-checked={selected?.id === a.id} onClick={() => setPicked(a.id)}
                        className={cn('h-full w-full rounded-2xl border p-4 text-left text-sm transition', selected?.id === a.id ? 'border-gold-500 bg-gold-200/20 ring-1 ring-gold-500' : 'border-navy-100 hover:border-gold-400')}>
                        <span className="flex items-center gap-2 font-semibold text-navy-900">{a.label}{a.is_default && <Badge tone="gold">Default</Badge>}</span>
                        <span className="mt-1 block font-medium text-navy-800">{a.recipient_name} · {a.phone}</span>
                        {formatAddressLines(a).map((l) => <span key={l} className="block text-navy-700">{l}</span>)}
                      </button>
                    </li>
                  ))}
                </ul>
                <Button variant="ghost" size="sm" className="mt-3" onClick={() => setAdding(true)}><Plus className="size-4" /> Add a new address</Button>
              </>
            )}
            {q?.delivery.pincode && !q.delivery.serviceable && <div className="mt-4"><Alert tone="error">Sorry, we do not deliver to {emirateName(q.delivery.pincode)} yet. Please choose another address.</Alert></div>}
          </section>

          <section className="card p-5">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-navy-900"><CreditCard className="size-5 text-gold-600" /> Payment</h2>
            <div className="grid gap-3" role="radiogroup" aria-label="How do you want to pay?">
              <button type="button" role="radio" aria-checked={!useInst} onClick={() => setMode('full')}
                className={cn('rounded-2xl border p-4 text-left text-sm transition', !useInst ? 'border-gold-500 bg-gold-200/20 ring-1 ring-gold-500' : 'border-navy-100 hover:border-gold-400')}>
                <span className="block font-semibold text-navy-900">Pay in full by card {q && <span className="font-bold">· {formatAED(q.total_paise)}</span>}</span>
                <span className="mt-1 block text-navy-700">You will pay on Stripe's secure page right after placing the order. Unpaid orders are released after 60 minutes.</span>
              </button>
              {offerInstallments && (
                <div className={cn('rounded-2xl border p-4 text-sm transition', useInst ? 'border-gold-500 bg-gold-200/20 ring-1 ring-gold-500' : 'border-navy-100')}>
                  <button type="button" role="radio" aria-checked={useInst} disabled={!canInstall} onClick={() => setMode('installment')} className="w-full text-left disabled:cursor-not-allowed">
                    <span className="flex items-center gap-2 font-semibold text-navy-900"><CalendarClock className="size-4 text-gold-700" /> Pay in {schedule!.length} monthly installments · {formatAED(firstPay)} today</span>
                    <span className="mt-1 block text-navy-700">No interest, no fee. {schedule!.length - 1} more payments of about {formatAED(laterPay)}, one each month.</span>
                  </button>
                  {!canInstall && user && elig && (
                    <ul className="mt-3 space-y-1 text-navy-700">
                      <li className="font-semibold text-navy-900">To unlock installments:</li>
                      {instReasons.map((r) => { const l = reasonLink(r); return <li key={r}>• {r}{l && <> · <Link to={l.to} className="font-semibold text-gold-700 underline">{l.label}</Link></>}</li> })}
                    </ul>
                  )}
                  {useInst && (
                    <div className="mt-4 rounded-xl bg-white p-3">
                      <AgreementText schedule={schedule} graceDays={inst?.grace_days} version={inst?.agreement_version} />
                      <label className="mt-3 flex items-start gap-2 font-medium text-navy-900">
                        <input type="checkbox" className="mt-0.5 size-4 accent-gold-500" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                        I have read and agree to the installment terms above.
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>
            <p className="mt-3 flex items-center gap-2 text-xs text-navy-600/80"><ShieldCheck className="size-4 text-success" /> Every order is checked and approved by our team before dispatch.</p>
          </section>

          <section className="card p-5">
            <TextareaField label="Note for our team (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="For example: call before delivery" />
          </section>
        </div>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <OrderSummary quote={q} coupon={coupon} onCoupon={setCoupon} loading={quote.isFetching}>
            {q?.errors.map((e) => <Alert key={e} tone="warning">{e}</Alert>)}
            {error && <Alert tone="error">{error}</Alert>}
            <Button size="lg" className="w-full" disabled={blocked || showForm} loading={place.isPending} onClick={() => { setError(null); place.mutate(selected!) }}>
              Place order{q ? ` · pay ${formatAED(payNow)}` : ''}
            </Button>
            <p className="text-center text-xs text-navy-600/70">By placing the order you agree to our <a href="/policies/terms" className="underline">Terms</a> and <a href="/policies/returns" className="underline">Returns policy</a>.</p>
          </OrderSummary>
        </aside>
      </div>
    </div>
  )
}
