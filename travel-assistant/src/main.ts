import 'leaflet/dist/leaflet.css'
import './style.css'
import {
  initMap,
  renderPOIMarkers,
  setNearbyPOIs,
  updateUserLocationMarker,
  clearUserLocationMarker,
  getCategoryColor,
  drawRouteLine,
  clearRouteLine,
  enableOnlineTiles,
  clearPOIMarkers,
} from './map/mapView'
import { pois as katmanduPois } from './poi/poiData'
import { watchUserLocation } from './gps/location'
import type { Position } from './gps/location'
import { getNearbyPOIs, haversineDistanceM } from './gps/proximity'
import { isPoiLiked, subscribeFavoriteChanges } from './poi/favorites'
import { renderInfoCard, setOnInfoCardClose, setOnTakeMeThere } from './poi/infoCard'
import type { POI } from './shared/types'

// ── Map ──────────────────────────────────────────────────────────────────────
const map = initMap()

// ── State ────────────────────────────────────────────────────────────────────
const KATHMANDU_CENTER = { lat: 27.7045, lng: 85.3076 }
const KATHMANDU_RADIUS_M = 2000

let activePois: POI[] = [...katmanduPois]
let localPoisGenerated = false

let stopWatchingLocation: (() => Promise<void>) | null = null
let isTrackingLocation = false
let hasCenteredOnUser = false
let proximityAlertsEnabled = localStorage.getItem('proximityAlertsEnabled') !== 'false'
let lastUserPosition: Position | null = null
let selectedPoi: POI | null = null

renderPOIMarkers(map, activePois)

// ── Nearby banner ─────────────────────────────────────────────────────────────
const nearbyBanner = document.createElement('div')
nearbyBanner.id = 'nearby-banner'
document.body.appendChild(nearbyBanner)

function updateNearbyBanner(nearbyPois: POI[]): void {
  if (!proximityAlertsEnabled || nearbyPois.length === 0) {
    nearbyBanner.textContent = ''
    nearbyBanner.classList.remove('is-visible')
    return
  }
  const names = nearbyPois.map((p) => p.name)
  const label = names.length === 1 ? names[0] : `${names[0]} + ${names.length - 1} more`
  nearbyBanner.innerHTML = `<strong>Nearby:</strong> ${label}`
  nearbyBanner.classList.add('is-visible')
}

// ── Dynamic local POI generator ───────────────────────────────────────────────
const LOCAL_POI_TEMPLATES: { name: string; category: string; short_hook: string; history: string; folklore: string; culture_note: string }[] = [
  {
    name: 'Local Café',
    category: 'cafe',
    short_hook: 'A cozy spot for a quick break.',
    history: 'A popular neighbourhood café serving the community.',
    folklore: 'Regulars say a good coffee here sets your day right.',
    culture_note: 'Often buzzing with locals in the morning.',
  },
  {
    name: 'Nearby Park',
    category: 'park',
    short_hook: 'A peaceful green space.',
    history: 'This park has served the local community for generations.',
    folklore: 'Children and elders have long gathered here.',
    culture_note: 'Popular for morning walks and weekend picnics.',
  },
  {
    name: 'Local Monument',
    category: 'heritage',
    short_hook: 'A landmark with local significance.',
    history: 'Erected to honour the history of this neighbourhood.',
    folklore: 'Said to bring luck to those who pass by.',
    culture_note: 'A point of pride for the surrounding community.',
  },
  {
    name: 'Community Gallery',
    category: 'gallery',
    short_hook: 'Showcasing local art and creativity.',
    history: 'Founded by local artists to promote community expression.',
    folklore: 'The walls carry stories of many generations.',
    culture_note: 'Free entry on weekends.',
  },
  {
    name: 'Public Library',
    category: 'library',
    short_hook: 'A quiet place for reading and learning.',
    history: 'Established as part of an initiative to promote literacy.',
    folklore: 'Legend says a rare manuscript is hidden in its archives.',
    culture_note: 'Popular with students and families alike.',
  },
]

/** Offsets in degrees — scatter POIs within ~50–200m of the user */
const OFFSETS: [number, number][] = [
  [0.0008, 0.0005],
  [-0.0006, 0.0010],
  [0.0012, -0.0007],
  [-0.0009, -0.0011],
  [0.0004, 0.0013],
]

function generateLocalPois(lat: number, lng: number): POI[] {
  return LOCAL_POI_TEMPLATES.map((tmpl, i) => ({
    id: `local-poi-${i}`,
    name: tmpl.name,
    category: tmpl.category,
    lat: lat + OFFSETS[i][0],
    lng: lng + OFFSETS[i][1],
    radius_m: 60,
    short_hook: tmpl.short_hook,
    history: tmpl.history,
    folklore: tmpl.folklore,
    culture_note: tmpl.culture_note,
  }))
}

function isOutsideKathmandu(lat: number, lng: number): boolean {
  return haversineDistanceM(lat, lng, KATHMANDU_CENTER.lat, KATHMANDU_CENTER.lng) > KATHMANDU_RADIUS_M
}

// ── Control panel (compact top-right toggle only) ─────────────────────────────
const controlPanel = document.createElement('div')
controlPanel.id = 'poi-control-panel'
controlPanel.innerHTML = `
  <div class="panel-header">
    <span class="panel-title">Proximity Alerts</span>
    <label class="switch">
      <input type="checkbox" id="alerts-toggle" ${proximityAlertsEnabled ? 'checked' : ''}>
      <span class="slider"></span>
    </label>
  </div>
`
document.body.appendChild(controlPanel)

const alertsToggle = controlPanel.querySelector('#alerts-toggle') as HTMLInputElement

// ── POI list modal (centered overlay) ────────────────────────────────────────
const listOverlay = document.createElement('div')
listOverlay.id = 'poi-list-overlay'
document.body.appendChild(listOverlay)

const listModal = document.createElement('div')
listModal.id = 'poi-list-modal'
listModal.innerHTML = `
  <div class="poi-list-modal-header">
    <span class="poi-list-modal-title">Points of Interest</span>
  </div>
  <div id="poi-list-items"></div>
`
document.body.appendChild(listModal)

const listItemsContainer = listModal.querySelector('#poi-list-items') as HTMLDivElement

function showListModal(): void {
  listOverlay.classList.add('is-visible')
  listModal.classList.add('is-visible')
}

function hideListModal(): void {
  listOverlay.classList.remove('is-visible')
  listModal.classList.remove('is-visible')
}

function renderPoiList(): void {
  if (proximityAlertsEnabled) return

  // Liked POIs first, fallback to all
  let filteredPois = activePois.filter(poi => isPoiLiked(poi.id))
  if (filteredPois.length === 0) filteredPois = [...activePois]

  // Sort by distance (closest first)
  if (lastUserPosition) {
    const pos = lastUserPosition
    filteredPois.sort((a, b) =>
      haversineDistanceM(pos.lat, pos.lng, a.lat, a.lng) -
      haversineDistanceM(pos.lat, pos.lng, b.lat, b.lng)
    )
  } else {
    filteredPois.sort((a, b) => a.name.localeCompare(b.name))
  }

  listItemsContainer.innerHTML = filteredPois.map(poi => {
    const isLiked = isPoiLiked(poi.id)
    const color = getCategoryColor(poi.category)
    let distanceStr = ''
    if (lastUserPosition) {
      const dist = haversineDistanceM(lastUserPosition.lat, lastUserPosition.lng, poi.lat, poi.lng)
      distanceStr = `${Math.round(dist)}m away`
    }
    return `
      <div class="poi-list-item" data-poi-id="${poi.id}">
        <div class="poi-list-item-left">
          <span class="poi-list-item-dot" style="background-color: ${color};"></span>
          <div class="poi-list-item-meta">
            <span class="poi-list-item-name">${poi.name}</span>
            ${distanceStr ? `<span class="poi-list-item-distance">${distanceStr}</span>` : ''}
          </div>
        </div>
        <span class="poi-list-item-heart ${isLiked ? '' : 'is-unliked'}">${isLiked ? '♥' : '♡'}</span>
      </div>
    `
  }).join('')

  // Bind clicks: hide list, show card, fly to POI
  listItemsContainer.querySelectorAll('.poi-list-item').forEach(item => {
    item.addEventListener('click', () => {
      const poiId = item.getAttribute('data-poi-id')
      const poi = activePois.find(p => p.id === poiId)
      if (!poi) return
      selectedPoi = poi
      hideListModal()
      renderInfoCard(poi)
      map.flyTo([poi.lat, poi.lng], 17)
    })
  })
}

// ── Toggle handler ─────────────────────────────────────────────────────────────
alertsToggle.addEventListener('change', () => {
  proximityAlertsEnabled = alertsToggle.checked
  localStorage.setItem('proximityAlertsEnabled', String(proximityAlertsEnabled))

  if (proximityAlertsEnabled) {
    hideListModal()
    clearRouteLine()
    if (lastUserPosition) {
      const nearbyPois = getNearbyPOIs(lastUserPosition.lat, lastUserPosition.lng, activePois)
      setNearbyPOIs(nearbyPois)
      updateNearbyBanner(nearbyPois)
    }
  } else {
    updateNearbyBanner([])
    renderPoiList()
    showListModal()
  }
})

// ── Info card callbacks ────────────────────────────────────────────────────────
setOnInfoCardClose(() => {
  clearRouteLine()
  selectedPoi = null
  if (!proximityAlertsEnabled) {
    renderPoiList()
    showListModal()
  }
})

setOnTakeMeThere(() => {
  if (selectedPoi && lastUserPosition) {
    drawRouteLine(map, lastUserPosition, selectedPoi)
  }
})

// ── Favorites subscription ─────────────────────────────────────────────────────
subscribeFavoriteChanges(() => {
  if (!proximityAlertsEnabled) renderPoiList()
})

// ── Location tracking ──────────────────────────────────────────────────────────
async function startLocationTracking(): Promise<void> {
  if (isTrackingLocation) return

  isTrackingLocation = true
  try {
    stopWatchingLocation = await watchUserLocation((position) => {
      lastUserPosition = position

      if (!hasCenteredOnUser) {
        map.setView([position.lat, position.lng], 17, { animate: false })
        hasCenteredOnUser = true
      }

      // If outside Kathmandu, swap to live tiles + generate local POIs (once)
      if (isOutsideKathmandu(position.lat, position.lng) && !localPoisGenerated) {
        localPoisGenerated = true
        enableOnlineTiles(map)
        clearPOIMarkers()
        activePois = generateLocalPois(position.lat, position.lng)
        renderPOIMarkers(map, activePois)
        console.log('Outside Kathmandu — switched to online tiles and generated local POIs')
      }

      updateUserLocationMarker(map, position)
      const nearbyPois = getNearbyPOIs(position.lat, position.lng, activePois)
      setNearbyPOIs(nearbyPois)
      updateNearbyBanner(nearbyPois)

      if (!proximityAlertsEnabled) renderPoiList()

      console.log('User location updated:', position)
    })
  } catch (error) {
    isTrackingLocation = false
    throw error
  }
}

async function stopLocationTracking(): Promise<void> {
  if (stopWatchingLocation) {
    await stopWatchingLocation()
    stopWatchingLocation = null
  }
  clearUserLocationMarker()
  setNearbyPOIs([])
  updateNearbyBanner([])
  isTrackingLocation = false
}

void startLocationTracking()

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    void stopLocationTracking()
    return
  }
  void startLocationTracking()
})

window.addEventListener('pagehide', () => { void stopLocationTracking() })
window.addEventListener('beforeunload', () => { void stopLocationTracking() })

// ── Initial state ─────────────────────────────────────────────────────────────
if (!proximityAlertsEnabled) {
  renderPoiList()
  showListModal()
}
