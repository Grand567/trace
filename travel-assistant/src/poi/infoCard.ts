import type { POI } from '../shared/types'

let activePoiId: string | null = null

export function renderInfoCard(poi: POI): void {
  let card = document.getElementById('info-card')

  if (!card) {
    card = document.createElement('div')
    card.id = 'info-card'
    card.innerHTML = `
      <button type="button" class="poi-close" aria-label="Close details">&times;</button>
      <div class="poi-content"></div>
    `

    const closeButton = card.querySelector('.poi-close')

    closeButton?.addEventListener('click', () => {
      card?.classList.remove('is-open')
    })

    document.body.appendChild(card)
  }

  const content = card.querySelector('.poi-content')
  const isSwitchingPoi = card.classList.contains('is-open') && activePoiId !== null && activePoiId !== poi.id

  if (isSwitchingPoi) {
    card.classList.remove('is-open')
  }

  if (content) {
    content.innerHTML = `
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

  activePoiId = poi.id

  window.setTimeout(() => {
    card.classList.add('is-open')
  }, isSwitchingPoi ? 160 : 0)
}
