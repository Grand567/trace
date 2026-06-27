/** Near Kathmandu Durbar Square — close to hackathon POIs for testing. */
export const DEV_FAKE_POSITION = {
  lat: 27.70405,
  lng: 85.30584,
} as const

/**
 * Dev-only fake GPS. Active when:
 * - running `npm run dev`, or
 * - built with VITE_USE_FAKE_GPS=true (for debug APK testing)
 */
export function isFakeGpsEnabled(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_USE_FAKE_GPS === 'true'
}

/**
 * Retrieves the current fake position, allowing runtime override via localStorage.
 */
export function getActiveFakePosition() {
  const override = localStorage.getItem('fakeGpsCoords')
  if (override) {
    try {
      const parsed = JSON.parse(override)
      if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
        return parsed
      }
    } catch (e) {
      console.warn('Failed to parse fakeGpsCoords override:', e)
    }
  }
  return DEV_FAKE_POSITION
}
