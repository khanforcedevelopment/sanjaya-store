import { useEffect } from 'react'

const DEFAULT_TITLE = 'Sanjaya Store'

function setMeta(selector: string, attr: string, key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector)
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el) }
  el.content = value
}

/** Sets the page title and description (and Open Graph tags) for SEO and link previews. */
export function useDocumentMeta({ title, description, image, noindex }: { title?: string; description?: string; image?: string | null; noindex?: boolean }) {
  useEffect(() => {
    const full = title ? (title.includes('Sanjaya') ? title : `${title} | Sanjaya Store`) : DEFAULT_TITLE
    document.title = full
    setMeta('meta[property="og:title"]', 'property', 'og:title', full)
    if (description) {
      setMeta('meta[name="description"]', 'name', 'description', description)
      setMeta('meta[property="og:description"]', 'property', 'og:description', description)
    }
    if (image) setMeta('meta[property="og:image"]', 'property', 'og:image', new URL(image, location.origin).href)
    setMeta('meta[name="robots"]', 'name', 'robots', noindex ? 'noindex' : 'index,follow')
  }, [title, description, image, noindex])
}
