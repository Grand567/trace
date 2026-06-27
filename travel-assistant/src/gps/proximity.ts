import type { POI } from '../shared/types'

const EARTH_RADIUS_M = 6_371_000

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

export function haversineDistanceM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRadians(lat2 - lat1)
  const dLng = toRadians(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2

  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function isNearPOI(lat: number, lng: number, poi: POI): boolean {
  const distanceM = haversineDistanceM(lat, lng, poi.lat, poi.lng)
  return distanceM <= poi.radius_m
}

export function getNearbyPOIs(lat: number, lng: number, list: POI[]): POI[] {
  return list.filter((poi) => isNearPOI(lat, lng, poi))
}
