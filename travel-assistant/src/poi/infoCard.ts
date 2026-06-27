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
    <p class="poi-hook">${poi.short_hook}</p>
    <section class="poi-section">
      <h3>History</h3>
      <p>${poi.history}</p>
    </section>
    <section class="poi-section">
      <h3>Folklore</h3>
      <p>${poi.folklore}</p>
    </section>
    <section class="poi-section">
      <h3>Today</h3>
      <p>${poi.culture_note}</p>
    </section>
  `
}
