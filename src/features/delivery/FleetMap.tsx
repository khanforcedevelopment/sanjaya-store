import { useEffect, useMemo } from 'react'
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export type FleetPoint = { id: string; name: string; lat: number; lng: number; color: string; note?: string }

/** Built with DOM nodes and textContent, so a rider's name can never inject HTML. */
function riderIcon(name: string, color: string) {
  const el = document.createElement('div')
  el.className = 'rider-marker'
  const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = color
  const label = document.createElement('span'); label.className = 'name'; label.textContent = name
  el.append(dot, label)
  return L.divIcon({ className: '', html: el, iconSize: [90, 40], iconAnchor: [45, 10] })
}

const warehouseIcon = L.divIcon({
  className: '', iconSize: [34, 34], iconAnchor: [17, 17],
  html: '<div style="width:34px;height:34px;border-radius:999px;background:#141414;display:grid;place-items:center;box-shadow:0 4px 12px rgba(0,0,0,.35);border:3px solid #fff"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5 12 4l9 5.5V20H3z"/><path d="M9 20v-6h6v6"/></svg></div>',
})

function FitAll({ points }: { points: [number, number][] }) {
  const map = useMap()
  const key = points.map((p) => p.join(',')).join('|')
  useEffect(() => {
    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 14 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map])
  return null
}

/** Live fleet map: warehouse pin plus one coloured marker per rider. */
export default function FleetMap({ warehouse, riders }: { warehouse: { lat: number; lng: number; name: string }; riders: FleetPoint[] }) {
  const icons = useMemo(() => new Map(riders.map((r) => [r.id, riderIcon(r.name, r.color)])), [riders])
  const pts: [number, number][] = [[warehouse.lat, warehouse.lng], ...riders.map((r) => [r.lat, r.lng] as [number, number])]
  return (
    <MapContainer center={[warehouse.lat, warehouse.lng]} zoom={11} scrollWheelZoom={false} className="h-[340px] w-full sm:h-[420px]">
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
      <Marker position={[warehouse.lat, warehouse.lng]} icon={warehouseIcon}><Tooltip>{warehouse.name}</Tooltip></Marker>
      {riders.map((r) => (
        <Marker key={r.id} position={[r.lat, r.lng]} icon={icons.get(r.id)!}>{r.note && <Tooltip>{r.note}</Tooltip>}</Marker>
      ))}
      <FitAll points={pts} />
    </MapContainer>
  )
}
