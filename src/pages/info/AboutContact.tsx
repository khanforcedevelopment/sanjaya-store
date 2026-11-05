import { Link } from 'react-router-dom'
import { Mail, MessageCircle, Phone, Smartphone } from 'lucide-react'
import { InfoPage } from './InfoLayout'
import { AppBadges } from '@/components/brand/AppBadges'
import { useStore } from './useStore'

export function AboutPage() {
  const s = useStore()
  return (
    <InfoPage title="About us" description={`${s.name}: electronics, fashion and lifestyle, delivered across India from Mumbai.`}>
      <p><strong>{s.name}</strong> brings electronics, fashion, footwear, watches, bags and lifestyle products to customers across India. Every order is checked by our team, packed in {s.dispatch_address} and delivered by our own delivery team or trusted partners.</p>
      <p>We keep things simple: clear prices in rupees, free delivery on your first order, secure card payments, and monthly installments on selected categories with no interest.</p>
      <p>The store is operated by {s.legal_name}, {s.registered_address}.{s.gstin ? ` GSTIN ${s.gstin}.` : ''}</p>
      <p><Link to="/contact">Contact us</Link> any time.</p>
    </InfoPage>
  )
}

export function ContactPage() {
  const s = useStore()
  return (
    <InfoPage title="Contact us" description="Reach Sanjaya Store by WhatsApp, phone or email.">
      <div className="grid gap-3 sm:grid-cols-2">
        <a href={`https://wa.me/${s.whatsapp}`} target="_blank" rel="noreferrer" className="card flex items-center gap-3 p-4 !no-underline"><MessageCircle className="size-6 text-gold-700" /><span><span className="block font-semibold text-navy-900">WhatsApp</span>+{s.whatsapp}</span></a>
        <a href={`tel:${s.support_phone.replace(/\s/g, '')}`} className="card flex items-center gap-3 p-4 !no-underline"><Phone className="size-6 text-gold-700" /><span><span className="block font-semibold text-navy-900">Phone</span>{s.support_phone}</span></a>
        <a href={`mailto:${s.support_email}`} className="card flex items-center gap-3 p-4 !no-underline"><Mail className="size-6 text-gold-700" /><span><span className="block font-semibold text-navy-900">Email</span>{s.support_email}</span></a>
        <Link to="/account/support" className="card flex items-center gap-3 p-4 !no-underline"><Smartphone className="size-6 text-gold-700" /><span><span className="block font-semibold text-navy-900">Help with an order</span>Open a request in My account</span></Link>
      </div>
      <p className="text-sm">Registered office: {s.legal_name}, {s.registered_address}. Dispatch: {s.dispatch_address}.</p>
    </InfoPage>
  )
}

export function InstallPage() {
  return (
    <InfoPage title="Install the app" description="Add Sanjaya Store to your phone for one-tap shopping.">
      <div className="flex items-center gap-4"><img src="/icons/icon-192.png" alt="" className="size-16 rounded-2xl" /><p>Shop faster with the Sanjaya Store app: opens from your home screen, works on slow networks and takes almost no space. Free, no app store needed.</p></div>
      <AppBadges className="not-prose" />
    </InfoPage>
  )
}
