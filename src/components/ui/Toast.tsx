import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'
import { cn } from '@/lib/cn'

interface Toast { id: number; message: string; tone: 'success' | 'error' }
const ToastContext = createContext<(message: string, tone?: Toast['tone']) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t.slice(-2), { id, message, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500)
  }, [])
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[70] flex flex-col items-center gap-2 px-4 md:bottom-6" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={cn('pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-white shadow-[var(--shadow-lift)]',
            t.tone === 'success' ? 'bg-navy-900' : 'bg-danger')}>
            {t.tone === 'success' ? <CheckCircle2 className="size-5 text-gold-300" aria-hidden /> : <AlertCircle className="size-5" aria-hidden />}
            <span>{t.message}</span>
            <button className="ml-1 opacity-70 hover:opacity-100" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} aria-label="Dismiss"><X className="size-4" /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
