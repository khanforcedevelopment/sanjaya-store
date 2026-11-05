import { cn } from '@/lib/cn'

/** Sanjaya Store emblem: a gold diamond frame around an engraved "S" (file: public/brand/emblem.svg). */
export function Monogram({ className, title = 'Sanjaya Store' }: { className?: string; title?: string }) {
  return <img src="/brand/emblem.svg" alt={title} width={64} height={64} className={cn('object-contain', className)} draggable={false} />
}

export function Wordmark({ className, tone = 'light' }: { className?: string; tone?: 'light' | 'dark' }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <Monogram className="size-11 shrink-0" title="" />
      <span className="flex flex-col items-center leading-none">
        <span className="block font-display text-[1.6rem] font-semibold tracking-[0.18em] gold-text">SANJAYA</span>
        <span className={cn('mt-1 flex w-full items-center gap-1.5 text-[0.55rem] font-semibold tracking-[0.5em]', tone === 'light' ? 'text-white/80' : 'text-navy-700')}>
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-gold-500" />
          <span className="-mr-[0.5em]">STORE</span>
          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-gold-500" />
        </span>
      </span>
    </span>
  )
}
