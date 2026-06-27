import 'leaflet/dist/leaflet.css'
import './style.css'
import { initMap, renderPOIMarkers, setNearbyPOIs, updateUserLocationMarker, clearUserLocationMarker, getCategoryColor, drawRouteLine, clearRouteLine } from './map/mapView'
import { pois } from './poi/poiData'
import { watchUserLocation } from './gps/location'
import type { Position } from './gps/location'
import { getNearbyPOIs, haversineDistanceM } from './gps/proximity'
import { isPoiLiked, subscribeFavoriteChanges } from './poi/favorites'
import { renderInfoCard, setOnInfoCardClose } from './poi/infoCard'

const map = initMap()

renderPOIMarkers(map, pois)

const nearbyBanner = document.createElement('div')
nearbyBanner.id = 'nearby-banner'
document.body.appendChild(nearbyBanner)

let stopWatchingLocation: (() => Promise<void>) | null = null
let isTrackingLocation = false
let hasCenteredOnUser = false
let proximityAlertsEnabled = localStorage.getItem('proximityAlertsEnabled') !== 'false'
let lastUserPosition: Position | null = null

function updateNearbyBanner(nearbyPois: typeof pois): void {
	if (!proximityAlertsEnabled || nearbyPois.length === 0) {
		nearbyBanner.textContent = ''
		nearbyBanner.classList.remove('is-visible')
		return
	}

	const names = nearbyPois.map((poi) => poi.name)
	const label = names.length === 1 ? names[0] : `${names[0]} + ${names.length - 1} more`

	nearbyBanner.innerHTML = `<strong>Nearby:</strong> ${label}`
	nearbyBanner.classList.add('is-visible')
}

async function startLocationTracking(): Promise<void> {
	if (isTrackingLocation) {
		return
	}

	isTrackingLocation = true
	try {
		stopWatchingLocation = await watchUserLocation((position) => {
			lastUserPosition = position
			if (!hasCenteredOnUser) {
				map.setView([position.lat, position.lng], 17, { animate: false })
				hasCenteredOnUser = true
			}

			updateUserLocationMarker(map, position)
			const nearbyPois = getNearbyPOIs(position.lat, position.lng, pois)
			setNearbyPOIs(nearbyPois)
			updateNearbyBanner(nearbyPois)

			if (!proximityAlertsEnabled) {
				renderPoiList()
			}

			console.log('User location updated:', position)
			console.log(
				'Nearby POIs:',
				nearbyPois.length > 0 ? nearbyPois.map((poi) => poi.name) : 'none',
			)
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

window.addEventListener('pagehide', () => {
	void stopLocationTracking()
})

window.addEventListener('beforeunload', () => {
	void stopLocationTracking()
})

// Control Panel generation & logic
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
  <div id="poi-list-container" class="poi-list-container ${proximityAlertsEnabled ? 'hidden' : ''}"></div>
`
document.body.appendChild(controlPanel)

const alertsToggle = controlPanel.querySelector('#alerts-toggle') as HTMLInputElement
const listContainer = controlPanel.querySelector('#poi-list-container') as HTMLDivElement

function renderPoiList(): void {
  if (proximityAlertsEnabled) {
    return
  }

  // Get liked POIs
  let filteredPois = pois.filter(poi => isPoiLiked(poi.id))

  // If no POIs liked yet, fallback to all POIs
  if (filteredPois.length === 0) {
    filteredPois = [...pois]
  }

  // Sort alphabetically by name
  filteredPois.sort((a, b) => a.name.localeCompare(b.name))

  // Render to listContainer
  listContainer.innerHTML = filteredPois.map(poi => {
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

  // Bind click listeners
  const items = listContainer.querySelectorAll('.poi-list-item')
  items.forEach(item => {
    item.addEventListener('click', () => {
      const poiId = item.getAttribute('data-poi-id')
      const poi = pois.find(p => p.id === poiId)
      if (poi) {
        renderInfoCard(poi)
        map.flyTo([poi.lat, poi.lng], 17)
        if (lastUserPosition) {
          drawRouteLine(map, lastUserPosition, poi)
        }
      }
    })
  })
}

alertsToggle.addEventListener('change', () => {
  proximityAlertsEnabled = alertsToggle.checked
  localStorage.setItem('proximityAlertsEnabled', String(proximityAlertsEnabled))

  if (proximityAlertsEnabled) {
    listContainer.classList.add('hidden')
    clearRouteLine()
    if (lastUserPosition) {
      const nearbyPois = getNearbyPOIs(lastUserPosition.lat, lastUserPosition.lng, pois)
      updateNearbyBanner(nearbyPois)
    }
  } else {
    listContainer.classList.remove('hidden')
    updateNearbyBanner([])
    renderPoiList()
  }
})

// Subscribe to favorite changes to auto-update the list
subscribeFavoriteChanges(() => {
  if (!proximityAlertsEnabled) {
    renderPoiList()
  }
})

// Register close callback for infoCard to clear the route line
setOnInfoCardClose(() => {
  clearRouteLine()
})

// Initial list render if alerts are off by default
if (!proximityAlertsEnabled) {
  renderPoiList()
}

