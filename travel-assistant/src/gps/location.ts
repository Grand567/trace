import { Geolocation } from '@capacitor/geolocation'
import { DEV_FAKE_POSITION, isFakeGpsEnabled } from './devLocation'

export interface Position {
  lat: number
  lng: number
}

function isLocationGranted(status: { location: string }): boolean {
  return status.location === 'granted'
}

/**
 * Checks Android/iOS location permission and requests it if missing.
 * On Android this covers ACCESS_COARSE_LOCATION and ACCESS_FINE_LOCATION.
 */
export async function ensureLocationPermission(): Promise<void> {
  const current = await Geolocation.checkPermissions()

  if (isLocationGranted(current)) {
    return
  }

  const requested = await Geolocation.requestPermissions()
  if (!isLocationGranted(requested)) {
    throw new Error('Location permission denied')
  }
}

export async function getCurrentPosition(): Promise<Position> {
  if (isFakeGpsEnabled()) {
    return { ...DEV_FAKE_POSITION }
  }

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

function toPosition(coords: { latitude: number; longitude: number }): Position {
  return {
    lat: coords.latitude,
    lng: coords.longitude,
  }
}

/**
 * Watches the user's location and calls `callback` on each update.
 * Returns a stop function — call it when you no longer need updates.
 */
export async function watchUserLocation(
  callback: (position: Position) => void,
): Promise<() => Promise<void>> {
  if (isFakeGpsEnabled()) {
    callback({ ...DEV_FAKE_POSITION })
    return async () => {}
  }

  await ensureLocationPermission()

  const watchId = await Geolocation.watchPosition(
    {
      enableHighAccuracy: true,
      timeout: 10_000,
    },
    (position, err) => {
      if (err || !position) {
        return
      }

      callback(toPosition(position.coords))
    },
  )

  return async () => {
    await Geolocation.clearWatch({ id: watchId })
  }
}
