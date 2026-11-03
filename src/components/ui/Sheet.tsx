import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Slide-over panel (right on desktop, bottom on phones when side="bottom"). */
export function Sheet({ open, onClose, title, children, side = 'right', className }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; side?: 'right' | 'bottom' | 'center'; className?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])
  if (!open) return null
  const panel = {
    right: 'right-0 top-0 h-full w-full max-w-md',
    bottom: 'inset-x-0 bottom-0 max-h-[88dvh] rounded-t-3xl',
    center: 'left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-3xl max-h-[90dvh]',
  }[side]
  return createPortal(
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className={cn('absolute flex flex-col overflow-hidden bg-white shadow-2xl', panel, className)}>
        <div className="flex items-center justify-between border-b border-navy-100 px-5 py-4">
          <h2 className="font-display text-2xl font-semibold text-navy-900">{title}</h2>
          <button onClick={onClose} className="grid size-9 place-items-center rounded-full hover:bg-navy-50" aria-label="Close"><X className="size-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
