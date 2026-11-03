import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { InputField, SelectField } from '@/components/ui/Field'
import { pincodeQuery, usePincodeCheck } from '@/features/catalog/api'
import { supabase } from '@/lib/supabase'
import { INDIAN_STATES } from '@/lib/indianStates'
import { formatDeliveryWindow } from '@/lib/format'
import { addressSchema, type AddressDraft, type AddressValues } from './addresses'

const LABELS = ['Home', 'Office', 'Other']

/** Address form used by the address book and (Phase 6) checkout. Validates with the same rules as the database. */
export function AddressForm({ initial, onSubmit, onCancel, submitLabel = 'Save address', busy, showDefault = true }: {
  initial: AddressDraft; onSubmit: (v: AddressValues) => void; onCancel?: () => void; submitLabel?: string; busy?: boolean; showDefault?: boolean
}) {
  const [v, setV] = useState<AddressDraft>(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = <K extends keyof AddressDraft>(k: K, val: AddressDraft[K]) => { setV((p) => ({ ...p, [k]: val })); setErrors((e) => ({ ...e, [k]: '' })) }
  const pin = /^[1-9][0-9]{5}$/.test(v.pincode) ? v.pincode : null
  const { data: check } = usePincodeCheck(pin)
  const qc = useQueryClient()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const r = addressSchema.safeParse(v)
    if (!r.success) {
      setErrors(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message])))
      return
    }
    onSubmit(r.data)
  }

  const onPincode = async (raw: string) => {
    const p = raw.replace(/\D/g, '').slice(0, 6)
    set('pincode', p)
    if (!supabase || !/^[1-9][0-9]{5}$/.test(p)) return
    // Fill city/state from our pincode table when the customer has not typed them yet.
    const c = await qc.fetchQuery(pincodeQuery(p)).catch(() => null)
    if (!c?.known) return
    const state = INDIAN_STATES.find((s) => s.toLowerCase() === (c.state ?? '').toLowerCase())
    setV((prev) => ({ ...prev, city: prev.city || c.city || '', state: prev.state || state || '' }))
  }
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="flex gap-2" role="radiogroup" aria-label="Address type">
        {LABELS.map((l) => (
          <button key={l} type="button" role="radio" aria-checked={v.label === l} onClick={() => set('label', l)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium ${v.label === l ? 'border-gold-500 bg-gold-200/40 text-navy-900' : 'border-navy-100 text-navy-700'}`}>{l}</button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <InputField label="Full name" autoComplete="name" value={v.recipient_name} onChange={(e) => set('recipient_name', e.target.value)} error={errors.recipient_name} />
        <InputField label="Mobile number" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="98765 43210" value={v.phone} onChange={(e) => set('phone', e.target.value)} error={errors.phone} hint="The rider will call this number." />
        <InputField label="Pincode" inputMode="numeric" autoComplete="postal-code" value={v.pincode} onChange={(e) => onPincode(e.target.value)} error={errors.pincode}
          hint={pin && check ? <PincodeHint check={check} /> : undefined} />
        <InputField label="House / flat / building" autoComplete="address-line1" value={v.house} onChange={(e) => set('house', e.target.value)} error={errors.house} />
        <InputField className="sm:col-span-2" label="Street, area, locality" autoComplete="address-line2" value={v.street} onChange={(e) => set('street', e.target.value)} error={errors.street} />
        <InputField className="sm:col-span-2" label="Landmark (optional)" value={v.landmark ?? ''} onChange={(e) => set('landmark', e.target.value)} error={errors.landmark} />
        <InputField label="City" autoComplete="address-level2" value={v.city} onChange={(e) => set('city', e.target.value)} error={errors.city} />
        <SelectField label="State" autoComplete="address-level1" value={v.state} onChange={(e) => set('state', e.target.value)} error={errors.state}>
          <option value="">Choose…</option>
          {INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}
        </SelectField>
      </div>
      {showDefault && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!v.is_default} onChange={(e) => set('is_default', e.target.checked)} className="size-4 accent-gold-500" /> Make this my default address
        </label>
      )}
      <div className="flex gap-3">
        <Button type="submit" loading={busy}>{submitLabel}</Button>
        {onCancel && <Button variant="ghost" onClick={onCancel}>Cancel</Button>}
      </div>
    </form>
  )
}

function PincodeHint({ check }: { check: NonNullable<ReturnType<typeof usePincodeCheck>['data']> }) {
  if (!check.serviceable) return <span className="flex items-center gap-1 text-danger"><AlertTriangle className="size-3.5" /> We do not deliver to this pincode yet.</span>
  return (
    <span className="flex items-center gap-1 text-success">
      <CheckCircle2 className="size-3.5" /> We deliver here{check.estimated_min_date ? `, arriving ${formatDeliveryWindow(check.estimated_min_date, check.estimated_max_date)}` : ''}{check.is_remote ? ' (remote area)' : ''}
    </span>
  )
}
