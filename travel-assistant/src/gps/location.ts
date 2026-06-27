export interface Position {
  lat: number
  lng: number
}

/**
 * TEMPORARY: Returns a hardcoded fake position until real GPS tracking is wired up.
 */
export function getCurrentPosition(): Position {
  return { lat: 51.505, lng: -0.09 }
}
