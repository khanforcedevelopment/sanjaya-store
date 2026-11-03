import { Link, useParams } from 'react-router-dom'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { usePublicSetting } from '@/features/catalog/api'
import { InfoPage } from './InfoLayout'
import { useStore, type StoreInfo } from './useStore'

const UPDATED = '3 November 2026'

function Contact({ s }: { s: StoreInfo }) {
  return <p>Email <a href={`mailto:${s.support_email}`}>{s.support_email}</a>, WhatsApp <a href={`https://wa.me/${s.whatsapp}`} target="_blank" rel="noreferrer">+{s.whatsapp}</a>, or open a request in <Link to="/account/support">My account → Help</Link>.</p>
}

function Grievance({ s }: { s: StoreInfo }) {
  return (
    <>
      <h2>Grievance officer</h2>
      {s.grievance_officer
        ? <p>{s.grievance_officer}. We acknowledge complaints within 48 hours and resolve them within one month, as required by the Consumer Protection (E-Commerce) Rules, 2020.</p>
        : <p>Complaints are handled by our customer care team (contact details above). We acknowledge complaints within 48 hours and resolve them within one month.</p>}
    </>
  )
}

function Terms({ s }: { s: StoreInfo }) {
  return (
    <InfoPage title="Terms & conditions" description={`Terms for shopping at ${s.name}.`} updated={UPDATED} draft>
      <p>{s.name} is operated by <strong>{s.legal_name}</strong>, {s.registered_address}. Orders are packed and dispatched from {s.dispatch_address}. By placing an order you agree to these terms.</p>
      <h2>Orders and approval</h2>
      <ul><li>Prices are in Indian rupees (₹) and include applicable taxes.</li><li>Every order is checked and approved by our team before dispatch. We may cancel an order (with a full refund) if an item is out of stock, priced in error, or the order looks fraudulent.</li><li>Unpaid orders are released after the payment window shown at checkout.</li></ul>
      <h2>Payment</h2>
      <p>Card payments are processed securely by Stripe. We never see or store your full card number. For monthly installments, see the <Link to="/installments">installment terms</Link>.</p>
      <h2>Delivery</h2>
      <p>See our <Link to="/policies/shipping">shipping policy</Link>. Our delivery partner will ask for the 4-digit delivery code shown on your order page; share it only when you receive the parcel.</p>
      <h2>Returns and refunds</h2>
      <p>See our <Link to="/policies/returns">returns policy</Link>.</p>
      <h2>Your account</h2>
      <ul><li>Keep your sign-in codes private. You are responsible for orders placed from your account.</li><li>Referral rewards are for genuine new customers. We may cancel rewards gained through fake or duplicate accounts.</li></ul>
      <h2>Contact</h2>
      <Contact s={s} />
      <Grievance s={s} />
      <p>These terms are governed by the laws of India. Courts at Mumbai have jurisdiction, without affecting your rights as a consumer.</p>
    </InfoPage>
  )
}

function Privacy({ s }: { s: StoreInfo }) {
  return (
    <InfoPage title="Privacy policy" description={`How ${s.name} handles your personal data.`} updated={UPDATED} draft>
      <p>{s.legal_name} ("we") processes your personal data to run this store, in line with India's Digital Personal Data Protection Act, 2023.</p>
      <h2>What we collect and why</h2>
      <ul>
        <li><strong>Account</strong>: email or mobile number, name, to sign you in and contact you about orders.</li>
        <li><strong>Addresses</strong>: to deliver your orders. Your exact map location is saved only if you tap "Use my location" and allow it.</li>
        <li><strong>Orders and payments</strong>: items, amounts and payment status. Card details are handled by Stripe, not by us.</li>
        <li><strong>Identity check</strong> (only if you apply for installments): document type, a secure fingerprint and the last 4 characters of the document number, your name as printed, and the photos you upload. We do not collect Aadhaar numbers. Photos can be viewed only by our Super Admin.</li>
        <li><strong>Support messages</strong> you send us.</li>
        <li><strong>Marketing</strong>: only if you tick the box in your profile; you can turn it off at any time.</li>
      </ul>
      <h2>Who we share it with</h2>
      <p>Only the services needed to run the store: Supabase (database and sign-in), Stripe (payments), our email and SMS providers, and our delivery staff (your name, phone and delivery address for your order). We do not sell your data.</p>
      <h2>How long we keep it</h2>
      <p>Order and payment records are kept as long as tax law requires. Identity-check photos are kept only as long as needed for your installment plans and the law; once you have no active plan, we delete them when you ask.</p>
      <h2>Your rights</h2>
      <p>You can view and correct your details in <Link to="/account/profile">My account</Link>, and ask us to delete your account or data, or withdraw consent, by contacting us:</p>
      <Contact s={s} />
      <Grievance s={s} />
    </InfoPage>
  )
}

function Returns({ s, days }: { s: StoreInfo; days: number }) {
  return (
    <InfoPage title="Returns & refunds" description={`Return items within ${days} days of delivery.`} updated={UPDATED} draft>
      <h2>Returns</h2>
      <ul>
        <li>You can request a return within <strong>{days} days of delivery</strong> from your order page (<Link to="/account/orders">My orders</Link> → order → "Request a return").</li>
        <li>Items must be unused, with tags and original packaging. Electronics must include all accessories and must not be activated or damaged.</li>
        <li>Not returnable: innerwear and personal-care items, unless they arrive damaged or wrong.</li>
        <li>Our team confirms the return and arranges pick-up. If an item arrives damaged or wrong, tell us within 48 hours with photos.</li>
      </ul>
      <h2>Cancellations</h2>
      <p>You can cancel from your order page until the order is packed. After that, please contact us.</p>
      <h2>Refunds</h2>
      <ul>
        <li>Refunds go back to the card you paid with, usually within 5–7 working days after we receive and check the item (or after cancellation).</li>
        <li>For installment orders, payments made are refunded and the remaining installments are cancelled.</li>
        <li>Free delivery on your first order is not used up if that order is cancelled or refunded.</li>
      </ul>
      <h2>Need help?</h2>
      <Contact s={s} />
    </InfoPage>
  )
}

function Shipping({ s }: { s: StoreInfo }) {
  const { data: d } = usePublicSetting<{ default_fee_paise?: number; first_order_free?: boolean }>('delivery')
  const fee = (d?.default_fee_paise ?? 5000) / 100
  return (
    <InfoPage title="Shipping policy" description="Delivery across India from Mumbai." updated={UPDATED} draft>
      <ul>
        <li>All orders are packed and dispatched from {s.dispatch_address} after our team approves them.</li>
        <li><strong>Delivery charge</strong>: {d?.first_order_free === false ? '' : 'your first order is delivered free; after that '}₹{fee} per order.</li>
        <li><strong>Delivery time</strong>: usually 2–7 days after dispatch depending on your pincode; remote areas (North-East, Jammu & Kashmir, Ladakh, islands) up to 12–13 days. Check your pincode on the <Link to="/delivery">delivery page</Link>.</li>
        <li>You get updates at every step and can track your order in <Link to="/account/orders">My orders</Link>. If your order is delayed, we tell you why and the new date.</li>
        <li>Our delivery partner asks for the 4-digit delivery code on your order page. If you are not available, we try again or contact you to reschedule.</li>
      </ul>
      <Contact s={s} />
    </InfoPage>
  )
}

export function PolicyPage() {
  const { slug } = useParams()
  const s = useStore()
  const { data: r } = usePublicSetting<{ window_days: number }>('returns')
  if (slug === 'terms') return <Terms s={s} />
  if (slug === 'privacy') return <Privacy s={s} />
  if (slug === 'returns') return <Returns s={s} days={r?.window_days ?? 7} />
  if (slug === 'shipping') return <Shipping s={s} />
  return <NotFoundPage />
}
