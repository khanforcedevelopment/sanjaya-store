import { Link } from 'react-router-dom'
import { Truck, ShieldCheck, RotateCcw, CreditCard } from 'lucide-react'
import { Wordmark } from '@/components/brand/Logo'
import { business } from '@/config/business'

const perks = [
  { icon: Truck, title: 'Free first delivery', text: 'Then ₹50 per order' },
  { icon: ShieldCheck, title: 'Secure payments', text: 'Card payments by Stripe' },
  { icon: RotateCcw, title: '7-day returns', text: 'On eligible items' },
  { icon: CreditCard, title: '6 easy installments', text: 'On selected categories' },
]

export function Footer() {
  return (
    <footer className="mt-16 bg-navy-950 pb-24 text-white/75 md:pb-0">
      <div className="border-b border-white/10">
        <ul className="container-x grid grid-cols-2 gap-6 py-8 md:grid-cols-4">
          {perks.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full border border-gold-500/40 text-gold-300"><Icon className="size-5" /></span>
              <span><span className="block text-sm font-semibold text-white">{title}</span><span className="text-xs">{text}</span></span>
            </li>
          ))}
        </ul>
      </div>
      <div className="container-x grid gap-10 py-12 md:grid-cols-4">
        <div className="md:col-span-1">
          <Wordmark />
          <p className="mt-4 text-sm leading-relaxed">Electronics, fashion and lifestyle, delivered across India by our own team from Mumbai.</p>
        </div>
        <FooterCol title="Shop" links={[['Mobile phones', '/c/mobiles'], ['Laptops & tablets', '/c/laptops-tablets'], ['Ethnic fashion', '/c/ethnic-wear'], ['Watches', '/c/watches'], ['Deals', '/deals']]} />
        <FooterCol title="Help" links={[['Track an order', '/account/orders'], ['Delivery & pincodes', '/delivery'], ['Returns & refunds', '/policies/returns'], ['Installment plans', '/installments'], ['Contact us', '/contact']]} />
        <FooterCol title="Company" links={[['About us', '/about'], ['Terms & conditions', '/policies/terms'], ['Privacy policy', '/policies/privacy'], ['Shipping policy', '/policies/shipping'], ['Install the app', '/install']]} />
      </div>
      <div className="border-t border-white/10">
        <div className="container-x flex flex-col gap-2 py-5 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {business.legalName}. All prices in INR, inclusive of taxes.</p>
          <p>Support: <a className="text-gold-300 hover:underline" href={`mailto:${business.supportEmail}`}>{business.supportEmail}</a></p>
        </div>
      </div>
    </footer>
  )
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">{title}</h3>
      <ul className="mt-4 space-y-2.5 text-sm">
        {links.map(([label, to]) => <li key={to}><Link to={to} className="hover:text-white">{label}</Link></li>)}
      </ul>
    </div>
  )
}
