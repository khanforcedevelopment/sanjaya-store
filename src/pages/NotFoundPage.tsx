import { ButtonLink } from '@/components/ui/Button'
import { useDocumentMeta } from '@/lib/meta'

export function NotFoundPage() {
  useDocumentMeta({ title: 'Page not found', noindex: true })
  return (
    <section className="container-x py-24 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-2 font-display text-4xl font-semibold text-navy-900">Page not found</h1>
      <p className="mt-2 text-navy-700">The page you are looking for has moved or no longer exists.</p>
      <ButtonLink to="/" className="mt-8">Back to the store</ButtonLink>
    </section>
  )
}
