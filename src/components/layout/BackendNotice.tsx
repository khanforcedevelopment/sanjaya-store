import { isBackendConfigured } from '@/lib/env'

/** Shown only while the Supabase backend is not connected (before setup). */
export function BackendNotice() {
  if (isBackendConfigured) return null
  return (
    <div className="border-b border-gold-300 bg-gold-200/50 text-center text-sm text-navy-900">
      <p className="container-x py-2.5"><strong>Our new store is opening soon.</strong> Products and ordering will appear here shortly.</p>
    </div>
  )
}
