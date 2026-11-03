import { Minus, Plus } from 'lucide-react'
import { MAX_QTY } from './cartStore'

export function QuantityStepper({ value, onChange, max = MAX_QTY, label = 'Quantity' }: { value: number; onChange: (v: number) => void; max?: number; label?: string }) {
  return (
    <div className="inline-flex items-center rounded-full border border-navy-100 bg-white" role="group" aria-label={label}>
      <button className="grid size-9 place-items-center rounded-full text-navy-800 hover:bg-navy-50 disabled:opacity-40" onClick={() => onChange(value - 1)} aria-label="Decrease quantity"><Minus className="size-4" /></button>
      <span className="w-8 text-center text-sm font-semibold tabular-nums" aria-live="polite">{value}</span>
      <button className="grid size-9 place-items-center rounded-full text-navy-800 hover:bg-navy-50 disabled:opacity-40" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="Increase quantity"><Plus className="size-4" /></button>
    </div>
  )
}
