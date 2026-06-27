import { Geolocation } from '@capacitor/geolocation'

export interface Position {
  lat: number
  lng: number
}

async function ensureLocationPermission(): Promise<void> {
  let { location } = await Geolocation.checkPermissions()

  if (location === 'granted') {
    return
  }

  const result = await Geolocation.requestPermissions()
  if (result.location !== 'granted') {
    throw new Error('Location permission denied')
  }
}

export async function getCurrentPosition(): Promise<Position> {
  await ensureLocationPermission()

  const { coords } = await Geolocation.getCurrentPosition({
    enableHighAccuracy: true,
    timeout: 10_000,
  })

  return {
    lat: coords.latitude,
    lng: coords.longitude,
  }
}
