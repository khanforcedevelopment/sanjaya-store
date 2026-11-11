import { useState, type FormEvent } from 'react'
import { CheckCircle2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { InputField, SelectField } from '@/components/ui/Field'
import { usePincodeCheck } from '@/features/catalog/api'
import { EMIRATES, emirateFromName, emirateName, isEmirateCode } from '@/lib/emirates'
import { formatDeliveryWindow } from '@/lib/format'
import { LocationPicker, type PickedLocation } from '@/features/delivery/LocationPicker'
import { addressSchema, type AddressDraft, type AddressValues } from './addresses'

const LABELS = ['Home', 'Office', 'Other']

/** Address form used by the address book and (Phase 6) checkout. Validates with the same rules as the database. */
export function AddressForm({ initial, onSubmit, onCancel, submitLabel = 'Save address', busy, showDefault = true }: {
  initial: AddressDraft; onSubmit: (v: AddressValues) => void; onCancel?: () => void; submitLabel?: string; busy?: boolean; showDefault?: boolean
}) {
  const [v, setV] = useState<AddressDraft>(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = <K extends keyof AddressDraft>(k: K, val: AddressDraft[K]) => { setV((p) => ({ ...p, [k]: val })); setErrors((e) => ({ ...e, [k]: '' })) }
  const pin = isEmirateCode(v.pincode) ? v.pincode : null
  const { data: check } = usePincodeCheck(pin)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const r = addressSchema.safeParse(v)
    if (!r.success) {
      setErrors(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message])))
      return
    }
    onSubmit(r.data)
  }

  // The emirate fills both the delivery code (stored as "pincode") and the state line of the address.
  const onEmirate = (code: string) => {
    setV((p) => ({ ...p, pincode: code, state: isEmirateCode(code) ? emirateName(code) : '' }))
    setErrors((e) => ({ ...e, pincode: '', state: '' }))
  }
  const onLocation = (loc: PickedLocation | null) => {
    if (!loc) { setV((p) => ({ ...p, latitude: null, longitude: null, location_source: 'manual' })); return }
    const a = loc.address
    const code = a?.pincode ?? emirateFromName(a?.state)
    setV((p) => ({
      ...p, latitude: loc.latitude, longitude: loc.longitude, location_source: 'gps',
      // fill only the fields the customer has not typed
      street: p.street || a?.street || '', city: p.city || a?.city || '',
      ...(!p.pincode && code ? { pincode: code, state: emirateName(code) } : {}),
    }))
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="flex gap-2" role="radiogroup" aria-label="Address type">
        {LABELS.map((l) => (
          <button key={l} type="button" role="radio" aria-checked={v.label === l} onClick={() => set('label', l)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium ${v.label === l ? 'border-gold-500 bg-gold-200/40 text-navy-900' : 'border-navy-100 text-navy-700'}`}>{l}</button>
        ))}
      </div>
      <LocationPicker value={{ latitude: v.latitude, longitude: v.longitude }} onChange={onLocation} />
      <div className="grid gap-4 sm:grid-cols-2">
        <InputField label="Full name" autoComplete="name" value={v.recipient_name} onChange={(e) => set('recipient_name', e.target.value)} error={errors.recipient_name} />
        <InputField label="Mobile number" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="50 123 4567" value={v.phone} onChange={(e) => set('phone', e.target.value)} error={errors.phone} hint="UAE mobile (+971). The rider will call this number." />
        <SelectField label="Emirate" autoComplete="address-level1" value={v.pincode} onChange={(e) => onEmirate(e.target.value)} error={errors.pincode || errors.state}
          hint={pin && check ? <PincodeHint check={check} /> : undefined}>
          <option value="">Choose…</option>
          {EMIRATES.map((e) => <option key={e.code} value={e.code}>{e.name}</option>)}
        </SelectField>
        <InputField label="Flat / villa / building" autoComplete="address-line1" value={v.house} onChange={(e) => set('house', e.target.value)} error={errors.house} />
        <InputField className="sm:col-span-2" label="Street and community" autoComplete="address-line2" value={v.street} onChange={(e) => set('street', e.target.value)} error={errors.street} />
        <InputField className="sm:col-span-2" label="Landmark (optional)" value={v.landmark ?? ''} onChange={(e) => set('landmark', e.target.value)} error={errors.landmark} />
        <InputField label="Area / city" autoComplete="address-level2" placeholder="e.g. Al Nahda, Jumeirah, Al Ain" value={v.city} onChange={(e) => set('city', e.target.value)} error={errors.city} />
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
  if (!check.serviceable) return <span className="flex items-center gap-1 text-danger"><AlertTriangle className="size-3.5" /> We do not deliver to this emirate yet.</span>
  return (
    <span className="flex items-center gap-1 text-success">
      <CheckCircle2 className="size-3.5" /> We deliver here{check.estimated_min_date ? `, arriving ${formatDeliveryWindow(check.estimated_min_date, check.estimated_max_date)}` : ''}
    </span>
  )
}
