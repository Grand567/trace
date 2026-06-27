import L from 'leaflet'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'
import type { POI } from '../shared/types'

// Kathmandu Durbar Square (matches offline tile download area)
const MAP_CENTER = { lat: 27.7045, lng: 85.3076 }
const DEFAULT_ZOOM = 16
const OFFLINE_MIN_ZOOM = 14
const OFFLINE_MAX_ZOOM = 17

const defaultIcon = L.icon({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

L.Marker.prototype.options.icon = defaultIcon

export function initMap(): L.Map {
  const map = L.map('map', {
    minZoom: OFFLINE_MIN_ZOOM,
    maxZoom: OFFLINE_MAX_ZOOM,
  }).setView([MAP_CENTER.lat, MAP_CENTER.lng], DEFAULT_ZOOM)

  // L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  //   attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  // }).addTo(map)

  L.tileLayer(`${import.meta.env.BASE_URL}tiles/{z}/{x}/{y}.png`, {
    minZoom: OFFLINE_MIN_ZOOM,
    maxZoom: OFFLINE_MAX_ZOOM,
    attribution:
      'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors (offline bundle)',
  }).addTo(map)

  return map
}

export function onMarkerTapped(poi: POI): void {
  console.log('POI tapped:', poi)
}

export function renderPOIMarkers(map: L.Map, pois: POI[]): void {
  for (const poi of pois) {
    const marker = L.marker([poi.lat, poi.lng]).addTo(map)
    marker.on('click', () => onMarkerTapped(poi))
  }
}
