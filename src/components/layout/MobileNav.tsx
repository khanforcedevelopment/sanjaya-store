import { NavLink } from 'react-router-dom'
import { Home, LayoutGrid, Heart, ShoppingBag, User } from 'lucide-react'
import { useCart } from '@/features/cart/CartProvider'
import { cn } from '@/lib/cn'

export function MobileNav() {
  const { count, setDrawerOpen } = useCart()
  const item = 'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium'
  const tone = ({ isActive }: { isActive: boolean }) => cn(item, isActive ? 'text-gold-600' : 'text-navy-700')
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-navy-100 bg-white/95 backdrop-blur md:hidden" aria-label="Main">
      <div className="flex">
        <NavLink to="/" end className={tone}><Home className="size-5" />Home</NavLink>
        <NavLink to="/categories" className={tone}><LayoutGrid className="size-5" />Categories</NavLink>
        <NavLink to="/account/wishlist" className={tone}><Heart className="size-5" />Wishlist</NavLink>
        <button onClick={() => setDrawerOpen(true)} className={cn(item, 'relative text-navy-700')}>
          <ShoppingBag className="size-5" />Cart
          {count > 0 && <span className="absolute left-1/2 top-1 ml-2 grid min-w-4 place-items-center rounded-full bg-gold-500 px-1 text-[10px] font-bold text-white">{count}</span>}
        </button>
        <NavLink to="/account" className={tone}><User className="size-5" />Account</NavLink>
      </div>
    </nav>
  )
}
