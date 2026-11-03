import type { ReactNode } from 'react'
import { PageTitle } from '@/components/ui/misc'
import { useDocumentMeta } from '@/lib/meta'

export function InfoPage({ title, description, updated, draft, children }: { title: string; description: string; updated?: string; draft?: boolean; children: ReactNode }) {
  useDocumentMeta({ title, description })
  return (
    <div className="container-x max-w-3xl py-10">
      <PageTitle title={title} subtitle={updated ? `Last updated ${updated}` : undefined} />
      {draft && <p className="mb-6 rounded-xl border border-gold-400/60 bg-gold-200/30 p-3 text-xs text-navy-800">This policy is being reviewed by our legal advisers and may be updated. The current version always applies to new orders.</p>}
      <div className="prose-info space-y-4 text-[15px] leading-relaxed text-navy-800 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-navy-900 [&_li]:ml-5 [&_li]:list-disc [&_a]:font-semibold [&_a]:text-gold-700 [&_a]:underline">{children}</div>
    </div>
  )
}
