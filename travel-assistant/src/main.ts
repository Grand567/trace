import 'leaflet/dist/leaflet.css'
import './style.css'
import { initMap, renderPOIMarkers } from './map/mapView'
import { pois } from './poi/poiData'

const map = initMap()

renderPOIMarkers(map, pois)

