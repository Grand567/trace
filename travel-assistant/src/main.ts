import 'leaflet/dist/leaflet.css'
import './style.css'
import { initMap, renderPOIMarkers } from './map/mapView'
import { pois } from './poi/poiData'
import { watchUserLocation } from './gps/location'
import { getNearbyPOIs } from './gps/proximity'

const map = initMap()

renderPOIMarkers(map, pois)

let stopWatchingLocation: (() => Promise<void>) | null = null

async function startLocationTracking(): Promise<void> {
	stopWatchingLocation = await watchUserLocation((position) => {
		const nearbyPois = getNearbyPOIs(position.lat, position.lng, pois)

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

