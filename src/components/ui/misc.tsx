import type { ReactNode } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatAED } from '@/lib/money'

export function Badge({ children, tone = 'gold', className }: { children: ReactNode; tone?: 'gold' | 'navy' | 'green' | 'red' | 'grey' | 'amber'; className?: string }) {
  const tones = {
    gold: 'bg-gold-200/60 text-gold-700 ring-gold-400/40',
    navy: 'bg-navy-900 text-gold-300 ring-navy-900',
    green: 'bg-emerald-50 text-success ring-emerald-200',
    red: 'bg-red-50 text-danger ring-red-200',
    grey: 'bg-navy-50 text-navy-700 ring-navy-100',
    amber: 'bg-amber-50 text-warning ring-amber-200',
  }
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', tones[tone], className)}>{children}</span>
}

export function Price({ paise, mrpPaise, size = 'md' }: { paise: number; mrpPaise?: number | null; size?: 'sm' | 'md' | 'lg' }) {
  const off = mrpPaise && mrpPaise > paise ? Math.round(((mrpPaise - paise) / mrpPaise) * 100) : 0
  const sizes = { sm: 'text-base', md: 'text-lg', lg: 'text-3xl' }
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className={cn('font-bold tracking-tight text-navy-900', sizes[size])}>{formatAED(paise)}</span>
      {off > 0 && (
        <>
          <span className="text-sm text-navy-600/60 line-through">{formatAED(mrpPaise!)}</span>
          <span className="text-sm font-semibold text-success">{off}% off</span>
        </>
      )}
    </div>
  )
}

export function Rating({ value, count, size = 'sm' }: { value: number; count?: number; size?: 'sm' | 'md' }) {
  const s = size === 'sm' ? 'size-3.5' : 'size-5'
  return (
    <span className="inline-flex items-center gap-1" aria-label={`Rated ${value.toFixed(1)} out of 5`}>
      <span className="flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} className={cn(s, i <= Math.round(value) ? 'fill-gold-400 text-gold-400' : 'text-navy-100')} aria-hidden />
        ))}
      </span>
      {count !== undefined && <span className="text-xs text-navy-600/70">({count})</span>}
    </span>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-navy-100/70', className)} />
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {icon && <div className="mb-4 grid size-14 place-items-center rounded-full bg-navy-50 text-gold-600">{icon}</div>}
      <h2 className="font-display text-2xl font-semibold text-navy-900">{title}</h2>
      {children && <div className="mt-2 max-w-md text-navy-700/80">{children}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export function Alert({ tone = 'info', title, children }: { tone?: 'info' | 'error' | 'success' | 'warning'; title?: string; children?: ReactNode }) {
  const tones = {
    info: 'border-navy-100 bg-navy-50 text-navy-800',
    error: 'border-red-200 bg-red-50 text-danger',
    success: 'border-emerald-200 bg-emerald-50 text-success',
    warning: 'border-amber-200 bg-amber-50 text-warning',
  }
  return (
    <div className={cn('rounded-xl border px-4 py-3 text-sm', tones[tone])} role={tone === 'error' ? 'alert' : 'status'}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? 'mt-0.5' : ''}>{children}</div>}
    </div>
  )
}

export function SectionHeading({ eyebrow, title, action, className }: { eyebrow?: string; title: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-6 flex items-end justify-between gap-4', className)}>
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 className="mt-1 font-display text-3xl font-semibold leading-tight text-navy-900 sm:text-4xl">{title}</h2>
      </div>
      {action}
    </div>
  )
}

export function PageTitle({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl font-semibold text-navy-900 sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-navy-700/80">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}
