import { useCallback, useEffect, useRef, useState, type ElementType, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * A horizontally scrolling row that works with every input:
 * touch swipe (native), trackpad, mouse drag, and arrow buttons
 * that appear only while there is more to scroll in that direction.
 */
export function ScrollRow({
  as: Tag = 'div',
  className,
  wrapperClassName,
  fadeClassName,
  tone = 'light',
  label,
  children,
}: {
  as?: ElementType
  className?: string
  wrapperClassName?: string
  /** extra classes for the arrow overlays, e.g. to match row padding */
  fadeClassName?: string
  /** light = white arrows on dark headers, dark = navy arrows on light pages */
  tone?: 'light' | 'dark'
  label?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLElement | null>(null)
  const [edges, setEdges] = useState({ left: false, right: false })

  const update = useCallback(() => {
    const el = ref.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setEdges({ left: el.scrollLeft > 2, right: max > 2 && el.scrollLeft < max - 2 })
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    update()
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    // ResizeObserver is missing on some older browsers; resize events still cover rotation.
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    if (ro) { ro.observe(el); for (const c of Array.from(el.children)) ro.observe(c) }
    return () => { el.removeEventListener('scroll', update); window.removeEventListener('resize', update); ro?.disconnect() }
  }, [update, children])

  // Mouse drag to scroll (touch and pen already scroll natively).
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let startX = 0, startLeft = 0, down = false, moved = false
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || el.scrollWidth <= el.clientWidth) return
      down = true; moved = false; startX = e.clientX; startLeft = el.scrollLeft
    }
    const onMove = (e: PointerEvent) => {
      if (!down) return
      const dx = e.clientX - startX
      if (!moved && Math.abs(dx) > 6) {
        moved = true
        el.style.scrollSnapType = 'none'
        el.style.cursor = 'grabbing'
        el.setPointerCapture?.(e.pointerId)
      }
      if (moved) { el.scrollLeft = startLeft - dx; e.preventDefault() }
    }
    const onUp = (e: PointerEvent) => {
      if (!down) return
      down = false
      el.style.scrollSnapType = ''
      el.style.cursor = ''
      if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId)
    }
    // A drag should not also open the link it started on.
    const onClick = (e: MouseEvent) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false } }
    const onDragStart = (e: DragEvent) => e.preventDefault()
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener('click', onClick, true)
    el.addEventListener('dragstart', onDragStart)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('click', onClick, true)
      el.removeEventListener('dragstart', onDragStart)
    }
  }, [])

  const go = (dir: -1 | 1) => {
    const el = ref.current
    if (el) el.scrollBy({ left: dir * Math.max(160, el.clientWidth * 0.8), behavior: 'smooth' })
  }

  const fade = tone === 'light' ? 'from-navy-900' : 'from-ivory'
  const btn = cn(
    'grid size-8 place-items-center rounded-full shadow-md transition',
    tone === 'light' ? 'bg-navy-800 text-white ring-1 ring-white/25 hover:bg-navy-700' : 'bg-white text-navy-900 ring-1 ring-navy-100 hover:ring-gold-500',
  )

  return (
    <div className={cn('relative min-w-0', wrapperClassName)}>
      <Tag ref={ref} className={cn('scrollbar-none overflow-x-auto overscroll-x-contain', className)} aria-label={label}>
        {children}
      </Tag>
      {edges.left && (
        <div className={cn('pointer-events-none absolute inset-y-0 left-0 z-10 flex w-14 items-center bg-gradient-to-r to-transparent pl-1', fade, fadeClassName)}>
          <button type="button" onClick={() => go(-1)} className={cn(btn, 'pointer-events-auto')} aria-label="Scroll left">
            <ChevronLeft className="size-4" />
          </button>
        </div>
      )}
      {edges.right && (
        <div className={cn('pointer-events-none absolute inset-y-0 right-0 z-10 flex w-14 items-center justify-end bg-gradient-to-l to-transparent pr-1', fade, fadeClassName)}>
          <button type="button" onClick={() => go(1)} className={cn(btn, 'pointer-events-auto')} aria-label="Scroll right">
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  )
}
