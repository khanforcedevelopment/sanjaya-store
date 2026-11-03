import { useId } from 'react'
import { cn } from '@/lib/cn'

/** Crowned "S" monogram, drawn for Sanjaya Store (navy and gold). */
export function Monogram({ className, title = 'Sanjaya Store' }: { className?: string; title?: string }) {
  const g = useId()
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label={title}>
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F2E3B6" />
          <stop offset="0.45" stopColor="#D8B45C" />
          <stop offset="1" stopColor="#A07B26" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="35" r="25" fill="none" stroke={`url(#${g})`} strokeWidth="2.2" />
      <path d="M21 14 L25 6 L29 12 L32 4 L35 12 L39 6 L43 14 Z" fill={`url(#${g})`} />
      <text x="32" y="46" textAnchor="middle" fontFamily="'Cormorant Garamond', Georgia, serif" fontSize="34" fontWeight="600" fill={`url(#${g})`}>S</text>
    </svg>
  )
}

export function Wordmark({ className, tone = 'light' }: { className?: string; tone?: 'light' | 'dark' }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <Monogram className="size-10 shrink-0" />
      <span className="leading-none">
        <span className="block font-display text-[1.55rem] font-semibold tracking-[0.14em] gold-text">SANJAYA</span>
        <span className={cn('mt-0.5 block text-[0.6rem] font-semibold tracking-[0.55em]', tone === 'light' ? 'text-white/80' : 'text-navy-700')}>STORE</span>
      </span>
    </span>
  )
}
