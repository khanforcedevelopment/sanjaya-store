import { useEffect } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// A gold pin drawn in SVG, so no marker image files are needed.
const pin = L.divIcon({
  className: '',
  iconSize: [32, 42],
  iconAnchor: [16, 42],
  html: '<svg width="32" height="42" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg"><path d="M16 0C7.2 0 0 7 0 15.7 0 27.5 16 42 16 42s16-14.5 16-26.3C32 7 24.8 0 16 0z" fill="#0b1b3f"/><circle cx="16" cy="15.5" r="6.5" fill="#d4af37"/></svg>',
})

function Follow({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => { map.setView([lat, lng], Math.max(map.getZoom(), 17)) }, [lat, lng, map])
  return null
}
function ClickToMove({ onMove }: { onMove: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onMove(e.latlng.lat, e.latlng.lng) })
  return null
}

/** Map with a draggable pin. Loaded lazily so Leaflet only downloads when a customer uses it. */
export default function MapPin({ lat, lng, onMove }: { lat: number; lng: number; onMove: (lat: number, lng: number) => void }) {
  return (
    <MapContainer center={[lat, lng]} zoom={17} scrollWheelZoom={false} className="h-64 w-full rounded-2xl" attributionControl>
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
      <Marker position={[lat, lng]} icon={pin} draggable
        eventHandlers={{ dragend: (e) => { const p = (e.target as L.Marker).getLatLng(); onMove(p.lat, p.lng) } }} />
      <ClickToMove onMove={onMove} />
      <Follow lat={lat} lng={lng} />
    </MapContainer>
  )
}
