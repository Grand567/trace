/** Near Kathmandu Durbar Square — close to hackathon POIs for testing. */
export const DEV_FAKE_POSITION = {
  lat: 27.7045,
  lng: 85.3076,
} as const

/**
 * Dev-only fake GPS. Active when:
 * - running `npm run dev`, or
 * - built with VITE_USE_FAKE_GPS=true (for debug APK testing)
 */
export function isFakeGpsEnabled(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_USE_FAKE_GPS === 'true'
}
