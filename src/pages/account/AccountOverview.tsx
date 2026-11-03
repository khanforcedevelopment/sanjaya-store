import { Link } from 'react-router-dom'
import { Copy, Gift, Heart, MapPin, UserRound } from 'lucide-react'
import { PageTitle } from '@/components/ui/misc'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/features/account/AuthProvider'
import { useAddresses, formatAddressLines } from '@/features/account/addresses'
import { useWishlist } from '@/features/catalog/api'
import { useDocumentMeta } from '@/lib/meta'

export function AccountOverview() {
  useDocumentMeta({ title: 'My account', noindex: true })
  const { profile, user } = useAuth()
  const { data: addresses } = useAddresses(user?.id)
  const { data: wish } = useWishlist(user?.id)
  const toast = useToast()
  const first = profile?.full_name?.split(' ')[0]
  const def = addresses?.find((a) => a.is_default)
  const invite = profile ? `${location.origin}/?ref=${profile.referral_code}` : ''

  const copy = async () => {
    try { await navigator.clipboard.writeText(invite); toast('Invite link copied') } catch { toast(invite) }
  }

  return (
    <>
      <PageTitle title={first ? `Hello, ${first}` : 'My account'} subtitle={user?.email ?? user?.phone ?? undefined} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Link to="/account/profile" className="card p-5 hover:border-gold-500">
          <UserRound className="size-6 text-gold-600" />
          <p className="mt-3 font-semibold text-navy-900">Profile</p>
          <p className="text-sm text-navy-700">{profile?.full_name || 'Add your name'}{profile?.phone ? ` · ${profile.phone}` : ''}</p>
        </Link>
        <Link to="/account/addresses" className="card p-5 hover:border-gold-500">
          <MapPin className="size-6 text-gold-600" />
          <p className="mt-3 font-semibold text-navy-900">Addresses</p>
          <p className="line-clamp-2 text-sm text-navy-700">{def ? formatAddressLines(def).join(', ') : 'No saved address yet'}</p>
        </Link>
        <Link to="/account/wishlist" className="card p-5 hover:border-gold-500">
          <Heart className="size-6 text-gold-600" />
          <p className="mt-3 font-semibold text-navy-900">Wishlist</p>
          <p className="text-sm text-navy-700">{wish?.size ? `${wish.size} saved item${wish.size === 1 ? '' : 's'}` : 'Nothing saved yet'}</p>
        </Link>
      </div>
      {profile && (
        <div className="mt-6 overflow-hidden rounded-2xl bg-navy-900 p-6 text-white">
          <div className="flex flex-wrap items-center gap-4">
            <Gift className="size-8 text-gold-300" />
            <div className="flex-1">
              <p className="font-display text-2xl font-semibold">Invite 5 friends, get a free gift</p>
              <p className="text-sm text-white/70">Share your link. A friend counts once their first order is delivered.</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <code className="rounded-full bg-white/10 px-4 py-2 text-sm tracking-widest text-gold-200">{profile.referral_code}</code>
            <Button variant="light" size="sm" onClick={copy}><Copy className="size-4" /> Copy invite link</Button>
          </div>
        </div>
      )}
    </>
  )
}
