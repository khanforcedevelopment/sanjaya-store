import { NavLink, Outlet } from 'react-router-dom'
import { CalendarClock, Heart, LayoutDashboard, LogOut, MapPin, UserRound, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/features/account/AuthProvider'
import { cn } from '@/lib/cn'

const LINKS = [
  { to: '/account', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/account/profile', label: 'Profile', icon: UserRound },
  { to: '/account/addresses', label: 'Addresses', icon: MapPin },
  { to: '/account/wishlist', label: 'Wishlist', icon: Heart },
  { to: '/account/installments', label: 'Installments', icon: CalendarClock },
]

export function AccountLayout() {
  const { profile, user, signOut, isStaff } = useAuth()
  const name = profile?.full_name || user?.email || user?.phone || 'Customer'
  return (
    <div className="container-x py-8">
      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="min-w-0">
          <div className="mb-4 hidden lg:block">
            <p className="eyebrow">My account</p>
            <p className="mt-1 truncate font-display text-xl font-semibold text-navy-900">{name}</p>
          </div>
          <nav aria-label="Account" className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:gap-1 lg:px-0">
            {LINKS.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end}
                className={({ isActive }) => cn('flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium lg:rounded-xl',
                  isActive ? 'bg-navy-900 text-white' : 'border border-navy-100 bg-white text-navy-800 hover:border-gold-500 lg:border-transparent lg:bg-transparent')}>
                <Icon className="size-4" /> {label}
              </NavLink>
            ))}
            {isStaff && (
              <NavLink to="/admin" className="flex items-center gap-2 whitespace-nowrap rounded-full border border-gold-300 px-4 py-2 text-sm font-medium text-gold-700 lg:rounded-xl">
                <ShieldCheck className="size-4" /> Staff panel
              </NavLink>
            )}
            <button onClick={() => signOut()} className="flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-navy-600 hover:text-danger lg:rounded-xl">
              <LogOut className="size-4" /> Sign out
            </button>
          </nav>
        </aside>
        <section className="min-w-0"><Outlet /></section>
      </div>
    </div>
  )
}
