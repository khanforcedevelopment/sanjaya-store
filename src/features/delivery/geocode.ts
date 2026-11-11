import { emirateFromName, emirateName } from '@/lib/emirates'

/** Reverse geocoding with OpenStreetMap Nominatim (free, low volume: one request per pin drop). */
/** pincode = emirate code (DXB, AUH, ...) when the point is in the UAE. */
export interface ReverseResult { pincode: string | null; street: string | null; city: string | null; state: string | null; display: string }

export async function reverseGeocode(lat: number, lng: number, signal?: AbortSignal): Promise<ReverseResult | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&accept-language=en&lat=${lat.toFixed(6)}&lon=${lng.toFixed(6)}`
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) return null
  const j = (await res.json()) as { display_name?: string; address?: Record<string, string> }
  return parseNominatim(j)
}

export function parseNominatim(j: { display_name?: string; address?: Record<string, string> }): ReverseResult | null {
  const a = j.address
  if (!a) return null
  const street = [a.road, a.neighbourhood ?? a.suburb ?? a.quarter].filter(Boolean).join(', ')
  return {
    pincode: a.country_code && a.country_code !== 'ae' ? null : emirateFromName(a.state ?? a.city),
    street: street || null,
    city: a.city ?? a.town ?? a.village ?? a.city_district ?? a.county ?? null,
    state: a.state ? emirateName(emirateFromName(a.state)) || a.state : null,
    display: j.display_name ?? '',
  }
}
