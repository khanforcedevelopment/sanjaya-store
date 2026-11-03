import { lazy, Suspense, useRef, useState } from 'react'
import { Crosshair, Loader2, MapPin as MapPinIcon, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Alert, Skeleton } from '@/components/ui/misc'
import { reverseGeocode, type ReverseResult } from './geocode'

const MapPin = lazy(() => import('./MapPin'))

export interface PickedLocation { latitude: number; longitude: number; address: ReverseResult | null }

/**
 * Optional GPS pin for an address. Location is read only after the customer taps the button
 * and agrees in the browser prompt; the coordinates are saved only with the address.
 */
export function LocationPicker({ value, onChange }: {
  value: { latitude: number | null | undefined; longitude: number | null | undefined }
  onChange: (loc: PickedLocation | null) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [label, setLabel] = useState<string | null>(null)
  const abort = useRef<AbortController | null>(null)
  const has = value.latitude != null && value.longitude != null

  const lookup = async (lat: number, lng: number) => {
    abort.current?.abort()
    const ctl = new AbortController(); abort.current = ctl
    let address: ReverseResult | null = null
    try { address = await reverseGeocode(lat, lng, ctl.signal) } catch { /* offline or blocked: keep the pin without text */ }
    if (ctl.signal.aborted) return
    setLabel(address?.display ?? null)
    onChange({ latitude: lat, longitude: lng, address })
  }

  const locate = () => {
    setError(null)
    if (!('geolocation' in navigator)) return setError('Your browser cannot share location. Please type the address.')
    setBusy(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => { await lookup(pos.coords.latitude, pos.coords.longitude); setBusy(false) },
      (err) => {
        setBusy(false)
        setError(err.code === err.PERMISSION_DENIED
          ? 'Location permission was declined. You can still type your address, or allow location in your browser settings.'
          : 'We could not find your location. Please try again outdoors or type your address.')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    )
  }

  return (
    <div className="rounded-2xl border border-navy-100 bg-navy-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-navy-900"><MapPinIcon className="size-4 text-gold-600" /> Pin your location (optional)</p>
          <p className="text-xs text-navy-600/80">Helps our rider find you. We ask your browser only when you tap the button.</p>
        </div>
        {has
          ? <Button size="sm" variant="ghost" onClick={() => { onChange(null); setLabel(null) }}><X className="size-4" /> Remove pin</Button>
          : <Button size="sm" variant="outline" onClick={locate} loading={busy}><Crosshair className="size-4" /> Use my current location</Button>}
      </div>
      {error && <div className="mt-3"><Alert tone="warning">{error}</Alert></div>}
      {has && (
        <div className="mt-3 space-y-2">
          <Suspense fallback={<Skeleton className="h-64" />}>
            <MapPin lat={value.latitude!} lng={value.longitude!} onMove={(la, ln) => lookup(la, ln)} />
          </Suspense>
          <p className="flex items-start gap-1 text-xs text-navy-700">
            {busy ? <Loader2 className="mt-0.5 size-3 animate-spin" /> : null}
            Drag the pin or tap the map to adjust.{label ? ` Near: ${label}` : ''}
          </p>
        </div>
      )}
    </div>
  )
}
