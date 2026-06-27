import L from 'leaflet'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'
import type { Position } from '../gps/location'
import type { POI } from '../shared/types'
import { renderInfoCard } from '../poi/infoCard'

// Kathmandu Durbar Square (matches offline tile download area)
const MAP_CENTER = { lat: 27.7045, lng: 85.3076 }
const DEFAULT_ZOOM = 16
const OFFLINE_MIN_ZOOM = 14
const OFFLINE_MAX_ZOOM = 17

const markersByPoiId = new Map<string, L.Marker>()
const nearbyPoiIds = new Set<string>()
let userLocationMarker: L.Marker | null = null

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
    tap: false, // Prevents Leaflet's custom tap handler from interfering with native tap/pinch/pan gestures in Capacitor
    bounceAtZoomLimits: false, // Ensures smoother pinch-zoom and pan on mobile
  } as any).setView([MAP_CENTER.lat, MAP_CENTER.lng], DEFAULT_ZOOM)

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
  renderInfoCard(poi)
}

function getCategoryColor(category: string): string {
  const cat = category.toLowerCase()
  if (cat.includes('heritage')) return '#d32f2f'      // Red for heritage
  if (cat.includes('temple')) return '#f57c00'        // Orange for temples
  if (cat.includes('palace complex')) return '#7b1fa2' // Purple for palace complex
  if (cat.includes('palace')) return '#1976d2'        // Blue for palace
  return '#388e3c'                                    // Green default
}

function createPoiIcon(category: string, isNearby: boolean): L.DivIcon {
  const color = getCategoryColor(category)
  const nearbyRing = 'rgba(198, 90, 58, 0.85)'

  return L.divIcon({
    className: isNearby ? 'category-marker-icon is-nearby' : 'category-marker-icon',
    html: `
      <svg width="28" height="41" viewBox="0 0 28 41" style="display: block; overflow: visible;">
        <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 27 14 27s14-16.5 14-27c0-7.73-6.27-14-14-14z" fill="${color}" stroke="#ffffff" stroke-width="1.5" ${isNearby ? `filter="drop-shadow(0 0 8px ${nearbyRing})"` : ''}/>
        <circle cx="14" cy="14" r="5.5" fill="#ffffff"/>
        ${isNearby ? '<circle cx="14" cy="14" r="10.5" fill="none" stroke="#c65a3a" stroke-width="2" opacity="0.95"/>' : ''}
      </svg>
    `,
    iconSize: [28, 41],
    iconAnchor: [14, 41],
    popupAnchor: [0, -36],
  })
}

function refreshNearbyMarkerStyles(): void {
  for (const [poiId, marker] of markersByPoiId) {
    const poi = nearbyPoiIds.has(poiId)
    const markerPoi = marker.options as L.MarkerOptions & { poiCategory?: string }
    const category = markerPoi.poiCategory ?? ''

    marker.setIcon(createPoiIcon(category, poi))
    marker.setZIndexOffset(poi ? 1000 : 0)
  }
}

function createUserLocationIcon(): L.DivIcon {
  return L.divIcon({
    className: 'user-location-marker',
    html: `
      <span class="user-location-marker__pulse"></span>
      <span class="user-location-marker__ring"></span>
      <span class="user-location-marker__dot"></span>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
}

export function renderPOIMarkers(map: L.Map, pois: POI[]): void {
  for (const poi of pois) {
    const marker = L.marker([poi.lat, poi.lng], {
      icon: createPoiIcon(poi.category, nearbyPoiIds.has(poi.id)),
    }).addTo(map)
    marker.options.poiCategory = poi.category
    markersByPoiId.set(poi.id, marker)
    marker.on('click', () => onMarkerTapped(poi))
  }
}

export function setNearbyPOIs(nearbyPOIs: POI[]): void {
  nearbyPoiIds.clear()

  for (const poi of nearbyPOIs) {
    nearbyPoiIds.add(poi.id)
  }

  refreshNearbyMarkerStyles()
}

export function updateUserLocationMarker(map: L.Map, position: Position): void {
  if (!userLocationMarker) {
    userLocationMarker = L.marker([position.lat, position.lng], {
      icon: createUserLocationIcon(),
      interactive: false,
      keyboard: false,
      zIndexOffset: 2000,
    }).addTo(map)
    return
  }

  userLocationMarker.setLatLng([position.lat, position.lng])
}

export function clearUserLocationMarker(): void {
  if (!userLocationMarker) {
    return
  }

  userLocationMarker.remove()
  userLocationMarker = null
}
