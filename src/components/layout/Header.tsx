import { business } from '@/config/business'
import { useState, type FormEvent } from 'react'
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Heart, Menu, Search, ShoppingBag, User, X, ShieldCheck } from 'lucide-react'
import { Wordmark } from '@/components/brand/Logo'
import { useCart } from '@/features/cart/CartProvider'
import { useAuth } from '@/features/account/AuthProvider'
import { useCategories } from '@/features/catalog/api'
import { cn } from '@/lib/cn'

export function SearchBox({ className, autoFocus, onDone }: { className?: string; autoFocus?: boolean; onDone?: () => void }) {
  const [params] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const navigate = useNavigate()
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const term = q.trim()
    if (!term) return
    navigate(`/search?q=${encodeURIComponent(term)}`)
    onDone?.()
  }
  return (
    <form onSubmit={submit} role="search" className={cn('relative', className)}>
      <input
        value={q} onChange={(e) => setQ(e.target.value)} autoFocus={autoFocus} type="search" enterKeyHint="search"
        placeholder="Search kitchen, electronics, accessories…" aria-label="Search products"
        className="h-11 w-full rounded-full border border-white/10 bg-white pl-5 pr-12 text-[15px] text-ink placeholder:text-navy-600/50 focus:outline-none focus:ring-2 focus:ring-gold-400"
      />
      <button type="submit" className="absolute right-1 top-1 grid size-9 place-items-center rounded-full bg-gradient-to-b from-gold-300 to-gold-500 text-navy-950" aria-label="Search">
        <Search className="size-4" />
      </button>
    </form>
  )
}

export function Header() {
  const { count, setDrawerOpen } = useCart()
  const { user, isStaff } = useAuth()
  const { data: categories } = useCategories()
  const location = useLocation()
  // the menu remembers which page it was opened on, so navigating closes it
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const menuOpen = menuFor === location.pathname
  const setMenuOpen = (open: boolean) => setMenuFor(open ? location.pathname : null)
  const top = (categories ?? []).filter((c) => !c.parent_id)

  return (
    <header className="sticky top-0 z-40">
      <div className="bg-gradient-to-r from-gold-600 via-gold-400 to-gold-600 text-center text-[12px] font-semibold tracking-wide text-navy-950">
        <p className="container-x py-1.5"><span className="sm:hidden">Free first delivery · {business.deliveryFeeLabel} thereafter</span><span className="hidden sm:inline">Free delivery on your first order · {business.deliveryFeeLabel} thereafter · Delivering across the UAE</span></p>
      </div>
      <div className="bg-navy-900 text-white">
        <div className="container-x flex h-16 items-center gap-3 md:h-20 md:gap-6">
          <button className="-ml-2 grid size-10 place-items-center rounded-full hover:bg-white/10 lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <Link to="/" aria-label="Sanjaya Store home" className="shrink-0"><Wordmark /></Link>
          <SearchBox className="hidden flex-1 md:block md:max-w-xl lg:mx-6" />
          <nav className="ml-auto flex items-center gap-1" aria-label="Account">
            {isStaff && (
              <Link to="/admin" className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm text-gold-300 hover:bg-white/10 sm:flex">
                <ShieldCheck className="size-4" /> Admin
              </Link>
            )}
            <Link to={user ? '/account' : '/login'} className="hidden items-center gap-2 rounded-full px-3 py-2 text-sm hover:bg-white/10 md:flex">
              <User className="size-5" /> <span>{user ? 'Account' : 'Sign in'}</span>
            </Link>
            <Link to="/account/wishlist" className="hidden size-10 place-items-center rounded-full hover:bg-white/10 md:grid" aria-label="Wishlist">
              <Heart className="size-5" />
            </Link>
            <button onClick={() => setDrawerOpen(true)} className="relative grid size-11 place-items-center rounded-full hover:bg-white/10" aria-label={`Cart, ${count} items`}>
              <ShoppingBag className="size-5" />
              {count > 0 && (
                <span className="absolute right-0.5 top-0.5 grid min-w-5 place-items-center rounded-full bg-gold-400 px-1 text-[11px] font-bold text-navy-950">{count > 99 ? '99+' : count}</span>
              )}
            </button>
          </nav>
        </div>
        <div className="container-x pb-3 md:hidden"><SearchBox /></div>
        <nav className="hidden border-t border-white/10 lg:block" aria-label="Categories">
          <ul className="container-x scrollbar-none flex gap-1 overflow-x-auto py-1.5 text-[13.5px]">
            {top.map((c) => (
              <li key={c.id}>
                <NavLink to={`/c/${c.slug}`} className={({ isActive }) => cn('block whitespace-nowrap rounded-full px-3.5 py-1.5 text-white/85 transition hover:bg-white/10 hover:text-white', isActive && 'bg-white/10 text-gold-300')}>
                  {c.name}
                </NavLink>
              </li>
            ))}
            <li><NavLink to="/deals" className="block whitespace-nowrap rounded-full px-3.5 py-1.5 font-semibold text-gold-300 hover:bg-white/10">Deals</NavLink></li>
          </ul>
        </nav>
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-navy-950/60" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[85%] max-w-sm flex-col bg-navy-900 text-white">
            <div className="flex items-center justify-between px-5 py-4">
              <Wordmark />
              <button onClick={() => setMenuOpen(false)} className="grid size-10 place-items-center rounded-full hover:bg-white/10" aria-label="Close menu"><X className="size-5" /></button>
            </div>
            <div className="gold-rule mx-5" />
            <ul className="flex-1 overflow-y-auto px-3 py-3">
              {top.map((c) => (
                <li key={c.id}><Link to={`/c/${c.slug}`} className="block rounded-xl px-3 py-3 text-[15px] hover:bg-white/10">{c.name}</Link></li>
              ))}
              <li><Link to="/deals" className="block rounded-xl px-3 py-3 font-semibold text-gold-300 hover:bg-white/10">Deals & flash sale</Link></li>
            </ul>
            <div className="border-t border-white/10 p-4 text-sm">
              <Link to={user ? '/account' : '/login'} className="block rounded-xl px-3 py-3 hover:bg-white/10">{user ? 'My account' : 'Sign in / Register'}</Link>
              {isStaff && <Link to="/admin" className="block rounded-xl px-3 py-3 text-gold-300 hover:bg-white/10">Admin panel</Link>}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
