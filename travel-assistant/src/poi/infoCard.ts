import type { POI } from '../shared/types'
import { isPoiLiked, togglePoiLiked } from './favorites'

let activePoiId: string | null = null
let infoCardCloseCallback: (() => void) | null = null
let takeMeThereCallback: (() => void) | null = null

export function setOnInfoCardClose(callback: () => void): void {
  infoCardCloseCallback = callback
}

export function setOnTakeMeThere(callback: () => void): void {
  takeMeThereCallback = callback
}

function setLikeButtonState(button: HTMLButtonElement | null, isLiked: boolean): void {
  if (!button) {
    return
  }

  button.classList.toggle('is-liked', isLiked)
  button.setAttribute('aria-pressed', String(isLiked))
  button.setAttribute('aria-label', isLiked ? 'Remove from favorites' : 'Add to favorites')
  button.textContent = isLiked ? '♥' : '♡'
}

export function renderInfoCard(poi: POI): void {
  let card = document.getElementById('info-card')

  if (!card) {
    card = document.createElement('div')
    card.id = 'info-card'
    card.innerHTML = `
      <div class="poi-drag-handle" id="poi-drag-handle" aria-label="Expand or shrink card" role="button">
        <span class="poi-drag-indicator"></span>
      </div>
      <div class="poi-actions">
        <button type="button" class="poi-like" aria-pressed="false" aria-label="Add to favorites">♡</button>
        <button type="button" class="poi-close" aria-label="Close details">&times;</button>
      </div>
      <div class="poi-content"></div>
      <div class="poi-route-action">
        <button type="button" class="btn-take-me-there" id="btn-take-me-there">🗺 Take Me There</button>
      </div>
    `

    const closeButton = card.querySelector('.poi-close')
    const likeButton = card.querySelector('.poi-like') as HTMLButtonElement | null
    const takeMeThereBtn = card.querySelector('#btn-take-me-there') as HTMLButtonElement | null
    const handle = card.querySelector('.poi-drag-handle')

    // Click/Tap toggle
    handle?.addEventListener('click', () => {
      card?.classList.toggle('is-fullscreen')
    })

    // Drag detection setup
    let dragStartY = 0
    let isDragging = false

    // Touch events (Mobile)
    handle?.addEventListener('touchstart', (e: TouchEvent) => {
      dragStartY = e.touches[0].clientY
      isDragging = true
    }, { passive: true })

    handle?.addEventListener('touchmove', (e: TouchEvent) => {
      if (!isDragging) return
      const currentY = e.touches[0].clientY
      const deltaY = currentY - dragStartY

      if (deltaY < -50 && !card?.classList.contains('is-fullscreen')) {
        card?.classList.add('is-fullscreen')
        isDragging = false
      } else if (deltaY > 50 && card?.classList.contains('is-fullscreen')) {
        card?.classList.remove('is-fullscreen')
        isDragging = false
      }
    }, { passive: true })

    handle?.addEventListener('touchend', () => {
      isDragging = false
    })

    // Mouse events (Desktop)
    handle?.addEventListener('mousedown', (e: MouseEvent) => {
      dragStartY = e.clientY
      isDragging = true
    })

    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (!isDragging) return
      const currentY = e.clientY
      const deltaY = currentY - dragStartY

      if (deltaY < -50 && !card?.classList.contains('is-fullscreen')) {
        card?.classList.add('is-fullscreen')
        isDragging = false
      } else if (deltaY > 50 && card?.classList.contains('is-fullscreen')) {
        card?.classList.remove('is-fullscreen')
        isDragging = false
      }
    })

    document.addEventListener('mouseup', () => {
      isDragging = false
    })

    closeButton?.addEventListener('click', () => {
      card?.classList.remove('is-open')
      card?.classList.remove('is-fullscreen')
      if (infoCardCloseCallback) {
        infoCardCloseCallback()
      }
    })

    takeMeThereBtn?.addEventListener('click', () => {
      if (takeMeThereCallback) {
        takeMeThereCallback()
      }
    })

    likeButton?.addEventListener('click', () => {
      if (!activePoiId) {
        return
      }

      const isLiked = togglePoiLiked(activePoiId)
      setLikeButtonState(likeButton, isLiked)
      card?.classList.toggle('is-liked', isLiked)
    })

    document.body.appendChild(card)
  }

  const content = card.querySelector('.poi-content')
  const likeButton = card.querySelector('.poi-like') as HTMLButtonElement | null
  const isSwitchingPoi = card.classList.contains('is-open') && activePoiId !== null && activePoiId !== poi.id

  if (isSwitchingPoi) {
    card.classList.remove('is-open')
    card.classList.remove('is-fullscreen')
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
  const isLiked = isPoiLiked(poi.id)
  setLikeButtonState(likeButton, isLiked)
  card.classList.toggle('is-liked', isLiked)

  window.setTimeout(() => {
    card.classList.add('is-open')
  }, isSwitchingPoi ? 160 : 0)
}
