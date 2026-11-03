import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function AdminTitle({ title, children, subtitle }: { title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl font-semibold text-navy-900">{title}</h1>
        {subtitle && <p className="text-sm text-navy-700/80">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

export function Table({ head, children, empty, compact }: { head: ReactNode[]; children: ReactNode; empty?: boolean; compact?: boolean }) {
  return (
    <div className="card overflow-x-auto">
      <table className={cn('w-full text-left text-sm', !compact && 'min-w-[640px]')}>
        <thead className="border-b border-navy-100 bg-navy-50/60 text-xs uppercase tracking-wider text-navy-700">
          <tr>{head.map((h, i) => <th key={i} className="px-3 py-2.5 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-navy-100">{children}</tbody>
      </table>
      {empty && <p className="p-6 text-center text-sm text-navy-600/70">Nothing to show.</p>}
    </div>
  )
}
export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => <td className={cn('px-3 py-2.5 align-top', className)}>{children}</td>

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: 'warn' | 'ok' }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-navy-600/80">{label}</p>
      <p className={cn('mt-1 text-2xl font-bold', tone === 'warn' ? 'text-danger' : tone === 'ok' ? 'text-success' : 'text-navy-900')}>{value}</p>
    </div>
  )
}

/** Parses "1,299.50" style rupees into paise; null when invalid. */
export function rupeesInput(v: string): number | null {
  const n = Number(v.replace(/[,\s₹]/g, ''))
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null
}
