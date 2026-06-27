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

/**
 * Returns the hardcoded development fake position explicitly when called for testing.
 */
export function getFakePosition(): Position {
  return { ...DEV_FAKE_POSITION }
}

export async function getCurrentPosition(): Promise<Position> {
  if (isFakeGpsEnabled()) {
    return getFakePosition()
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
  callback: (position: Position | null, error?: any) => void,
): Promise<() => Promise<void>> {
  if (isFakeGpsEnabled()) {
    console.log('watchUserLocation: Using fake GPS position:', DEV_FAKE_POSITION)
    // Send immediate update
    const timeoutId = window.setTimeout(() => callback(getFakePosition(), null), 0)
    // Send periodic updates to simulate watch changes
    const intervalId = window.setInterval(() => callback(getFakePosition(), null), 4000)

    return async () => {
      window.clearTimeout(timeoutId)
      window.clearInterval(intervalId)
    }
  }

  await ensureLocationPermission()

  const watchId = await Geolocation.watchPosition(
    {
      enableHighAccuracy: true,
      timeout: 10_000,
    },
    (position, err) => {
      if (err || !position) {
        console.warn('GPS error or no position:', err)
        callback(null, err || new Error('No position received'))
        return
      }

      callback(toPosition(position.coords), null)
    },
  )

  return async () => {
    await Geolocation.clearWatch({ id: watchId })
  }
}
