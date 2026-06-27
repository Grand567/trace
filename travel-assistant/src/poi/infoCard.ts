import type { POI } from '../shared/types'

export function renderInfoCard(poi: POI): void {
  let card = document.getElementById('info-card')

  if (!card) {
    card = document.createElement('div')
    card.id = 'info-card'
    document.body.appendChild(card)
  }

  card.innerHTML = `
    <h2>${poi.name}</h2>
    <p>${poi.short_hook}</p>
  `
}
