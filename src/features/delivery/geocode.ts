/** Reverse geocoding with OpenStreetMap Nominatim (free, low volume: one request per pin drop). */
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
  const pin = (a.postcode ?? '').replace(/\s/g, '')
  const street = [a.road, a.neighbourhood ?? a.suburb ?? a.quarter].filter(Boolean).join(', ')
  return {
    pincode: /^[1-9][0-9]{5}$/.test(pin) ? pin : null,
    street: street || null,
    city: a.city ?? a.town ?? a.village ?? a.city_district ?? a.county ?? null,
    state: a.state ?? null,
    display: j.display_name ?? '',
  }
}
