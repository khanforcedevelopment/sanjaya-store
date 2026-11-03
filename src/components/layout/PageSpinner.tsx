import { Loader2 } from 'lucide-react'
export function PageSpinner() {
  return <div className="grid min-h-[40vh] place-items-center text-gold-500"><Loader2 className="size-8 animate-spin" aria-label="Loading" /></div>
}
