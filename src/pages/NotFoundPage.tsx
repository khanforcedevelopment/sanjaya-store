import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="font-display text-3xl text-navy-900">Page not found</h1>
      <Link to="/" className="mt-6 inline-block text-gold-600 underline">Back to the store</Link>
    </section>
  )
}
