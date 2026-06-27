import 'leaflet/dist/leaflet.css'
import './style.css'
import { initMap, renderPOIMarkers, setNearbyPOIs } from './map/mapView'
import { pois } from './poi/poiData'
import { watchUserLocation } from './gps/location'
import { getNearbyPOIs } from './gps/proximity'

const map = initMap()

renderPOIMarkers(map, pois)

const nearbyBanner = document.createElement('div')
nearbyBanner.id = 'nearby-banner'
document.body.appendChild(nearbyBanner)

let stopWatchingLocation: (() => Promise<void>) | null = null

function updateNearbyBanner(nearbyPois: typeof pois): void {
	if (nearbyPois.length === 0) {
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
	stopWatchingLocation = await watchUserLocation((position) => {
		const nearbyPois = getNearbyPOIs(position.lat, position.lng, pois)
		setNearbyPOIs(nearbyPois)
		updateNearbyBanner(nearbyPois)

		console.log('User location updated:', position)
		console.log(
			'Nearby POIs:',
			nearbyPois.length > 0 ? nearbyPois.map((poi) => poi.name) : 'none',
		)
	})
}

void startLocationTracking()

window.addEventListener('beforeunload', () => {
	void stopWatchingLocation?.()
})

