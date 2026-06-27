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
      ${poi.image_url ? `<img class="poi-image" src="${poi.image_url}" alt="${poi.name}" />` : ''}
      <div class="poi-header">
        <span class="poi-category">${poi.category}</span>
        <h2>${poi.name}</h2>
        <p class="poi-hook">${poi.short_hook}</p>
      </div>

      <div class="poi-tabs">
        <button class="tab-button active" data-tab="history">History</button>
        <button class="tab-button" data-tab="folklore">Folklore</button>
        <button class="tab-button" data-tab="today">Today</button>
      </div>

      <div class="tab-panels">
        <section class="tab-panel active" id="tab-history">
          <p>${poi.history}</p>
        </section>
        <section class="tab-panel" id="tab-folklore">
          <p>${poi.folklore}</p>
        </section>
        <section class="tab-panel" id="tab-today">
          <p>${poi.culture_note}</p>
        </section>
      </div>
    `

    const tabButtons = content.querySelectorAll('.tab-button')
    const tabPanels = content.querySelectorAll('.tab-panel')

    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const targetTab = button.getAttribute('data-tab')

        tabButtons.forEach(btn => btn.classList.remove('active'))
        tabPanels.forEach(panel => panel.classList.remove('active'))

        button.classList.add('active')
        const activePanel = content.querySelector(`#tab-${targetTab}`)
        activePanel?.classList.add('active')
      })
    })
  }

  activePoiId = poi.id

  window.setTimeout(() => {
    card.classList.add('is-open')
  }, isSwitchingPoi ? 160 : 0)
}
