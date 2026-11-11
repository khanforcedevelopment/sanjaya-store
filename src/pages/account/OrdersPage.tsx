import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Package } from 'lucide-react'
import { Badge, EmptyState, PageTitle, Skeleton } from '@/components/ui/misc'
import { ButtonLink } from '@/components/ui/Button'
import { useAuth } from '@/features/account/AuthProvider'
import { requireSupabase, supabase } from '@/lib/supabase'
import { formatAED } from '@/lib/money'
import { STATUS_LABEL, statusTone } from '@/lib/orderStatus'
import { useDocumentMeta } from '@/lib/meta'

export function OrdersPage() {
  useDocumentMeta({ title: 'My orders', noindex: true })
  const { user } = useAuth()
  const { data, isLoading } = useQuery({
    queryKey: ['orders', 'mine', user?.id],
    enabled: !!supabase && !!user,
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('orders')
        .select('id, order_number, status, total_paise, payment_mode, is_delayed, created_at, order_items(product_name, image_url, quantity)')
        .order('created_at', { ascending: false }).limit(100)
      if (error) throw error
      return data
    },
  })
  if (isLoading) return <Skeleton className="h-64" />
  return (
    <>
      <PageTitle title="My orders" subtitle="Track deliveries, see your delivery code and get help with an order." />
      {!data?.length ? (
        <EmptyState icon={<Package />} title="No orders yet" action={<ButtonLink to="/categories">Start shopping</ButtonLink>}>Your orders will appear here.</EmptyState>
      ) : (
        <ul className="card divide-y divide-navy-100">
          {data.map((o) => {
            const first = o.order_items[0]
            const more = o.order_items.length - 1
            return (
              <li key={o.id}>
                <Link to={`/order/${o.id}`} className="flex items-center gap-4 p-4 hover:bg-navy-50/50">
                  <div className="size-14 shrink-0 overflow-hidden rounded-xl bg-navy-50">{first?.image_url && <img src={first.image_url} alt="" className="size-full object-cover" />}</div>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-navy-900">
                      {o.order_number} <Badge tone={statusTone(o.status)}>{STATUS_LABEL[o.status]}</Badge>
                      {o.is_delayed && <Badge tone="red">Delayed</Badge>}{o.payment_mode === 'installment' && <Badge tone="gold">6 months</Badge>}
                    </p>
                    <p className="line-clamp-1 text-sm text-navy-700">{first?.product_name}{more > 0 ? ` and ${more} more` : ''}</p>
                    <p className="text-xs text-navy-600/80">{new Date(o.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · {formatAED(o.total_paise)}</p>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-navy-400" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
