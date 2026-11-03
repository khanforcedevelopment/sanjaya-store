import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useCategories } from '@/features/catalog/api'
import { categoryArt } from '@/features/catalog/categoryArt'
import { PageTitle, Skeleton } from '@/components/ui/misc'
import { useDocumentMeta } from '@/lib/meta'

export function CategoriesPage() {
  useDocumentMeta({ title: 'All categories' })
  const { data, isLoading } = useCategories()
  const top = (data ?? []).filter((c) => !c.parent_id)
  return (
    <div className="container-x py-8">
      <PageTitle title="All categories" />
      {isLoading ? <Skeleton className="h-96" /> : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {top.map((c) => {
            const kids = (data ?? []).filter((k) => k.parent_id === c.id)
            return (
              <li key={c.id} className="card overflow-hidden">
                <Link to={`/c/${c.slug}`} className="flex items-center gap-4 p-4 hover:bg-navy-50">
                  <img src={c.image_url ?? categoryArt(c.slug)} alt="" className="size-16 rounded-2xl object-cover" />
                  <span className="flex-1"><span className="block font-semibold text-navy-900">{c.name}</span><span className="text-sm text-navy-600/70">{c.description}</span></span>
                  <ChevronRight className="size-5 text-gold-600" />
                </Link>
                {kids.length > 0 && (
                  <div className="flex flex-wrap gap-2 border-t border-navy-100 px-4 py-3">
                    {kids.map((k) => <Link key={k.id} to={`/c/${k.slug}`} className="rounded-full bg-navy-50 px-3 py-1 text-sm hover:bg-gold-200/60">{k.name}</Link>)}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
