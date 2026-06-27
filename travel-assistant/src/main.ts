import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './style.css'
import { initMap } from './map/mapView'
import { pois } from './poi/poiData'
import { renderInfoCard } from './poi/infoCard'

const map = initMap()

for (const poi of pois) {
  const marker = L.marker([poi.lat, poi.lng]).addTo(map)
  marker.on('click', () => renderInfoCard(poi))
}
