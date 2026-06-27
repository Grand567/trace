const likedPoiIds = new Set<string>()
const listeners = new Set<() => void>()

function notifyFavoriteListeners(): void {
  for (const listener of listeners) {
    listener()
  }
}

export function isPoiLiked(poiId: string): boolean {
  return likedPoiIds.has(poiId)
}

export function togglePoiLiked(poiId: string): boolean {
  if (likedPoiIds.has(poiId)) {
    likedPoiIds.delete(poiId)
  } else {
    likedPoiIds.add(poiId)
  }

  notifyFavoriteListeners()
  return likedPoiIds.has(poiId)
}

export function subscribeFavoriteChanges(listener: () => void): () => void {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}
