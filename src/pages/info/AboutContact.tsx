import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Mail, MessageCircle, Phone, Share, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { InfoPage } from './InfoLayout'
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

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

export function InstallPage() {
  const [evt, setEvt] = useState<InstallEvent | null>(null)
  const [installed, setInstalled] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches)
  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as InstallEvent) }
    const onInstalled = () => setInstalled(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled) }
  }, [])
  const ios = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)
  return (
    <InfoPage title="Install the app" description="Add Sanjaya Store to your home screen for one-tap shopping.">
      <div className="flex items-center gap-4"><img src="/icons/icon-192.png" alt="" className="size-16 rounded-2xl" /><p>Shop faster with the Sanjaya Store app: opens from your home screen, works on slow networks and takes almost no space.</p></div>
      {installed ? <p className="font-semibold text-success">The app is installed on this device.</p> : evt ? (
        <Button size="lg" onClick={async () => { await evt.prompt(); const r = await evt.userChoice; if (r.outcome === 'accepted') setInstalled(true); setEvt(null) }}><Download className="size-5" /> Install Sanjaya Store</Button>
      ) : ios ? (
        <ol className="list-decimal space-y-1 pl-5"><li>Open this page in <strong>Safari</strong>.</li><li>Tap <Share className="inline size-4" /> <strong>Share</strong>.</li><li>Choose <strong>Add to Home Screen</strong>.</li></ol>
      ) : (
        <ol className="list-decimal space-y-1 pl-5"><li>Open this page in <strong>Chrome</strong>.</li><li>Tap the <strong>⋮</strong> menu.</li><li>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li></ol>
      )}
    </InfoPage>
  )
}
