import type { POI } from '../shared/types'
import { isPoiLiked, togglePoiLiked } from './favorites'
import { speak, stop as stopSpeech } from './tts'

const SPEAKER_SVG = `
  <svg class="icon-speaker" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
  </svg>
`

const PAUSE_SVG = `
  <svg class="icon-pause" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="6" y="4" width="4" height="16" fill="currentColor"></rect>
    <rect x="14" y="4" width="4" height="16" fill="currentColor"></rect>
  </svg>
`

let activeTtsTab: string | null = null


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

    const closeCard = () => {
      card?.classList.remove('is-open')
      card?.classList.remove('is-fullscreen')
      stopSpeech()
      activeTtsTab = null
      if (infoCardCloseCallback) {
        infoCardCloseCallback()
      }
    }

    closeButton?.addEventListener('click', () => {
      closeCard()
    })

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
      } else if (deltaY > 50) {
        if (card?.classList.contains('is-fullscreen')) {
          card?.classList.remove('is-fullscreen')
        } else {
          closeCard()
        }
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
      } else if (deltaY > 50) {
        if (card?.classList.contains('is-fullscreen')) {
          card?.classList.remove('is-fullscreen')
        } else {
          closeCard()
        }
        isDragging = false
      }
    })

    document.addEventListener('mouseup', () => {
      isDragging = false
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
    stopSpeech()
    activeTtsTab = null
  }

  if (content) {
    content.innerHTML = `
      ${poi.image_url ? `<img class="poi-image" src="${poi.image_url}" alt="${poi.name}" />` : ''}
      <div class="poi-header">
        <span class="poi-category">${poi.category}</span>
        <h2>${poi.name}</h2>
        <p class="poi-hook">${poi.short_hook}</p>
      </div>

      ${(() => {
        const hasHistory = !!poi.history?.trim()
        const hasFolklore = !!poi.folklore?.trim()
        const hasToday = !!poi.culture_note?.trim()

        const tabs = []
        if (hasHistory) tabs.push('history')
        if (hasFolklore) tabs.push('folklore')
        if (hasToday) tabs.push('today')

        if (tabs.length === 0) {
          return `<div class="poi-no-info">No detailed info for this spot yet.</div>`
        }

        const tabsHtml = `
          <div class="poi-tabs">
            ${tabs.map((tab, idx) => {
              const activeClass = idx === 0 ? 'active' : ''
              const label = tab === 'today' ? 'Today' : tab.charAt(0).toUpperCase() + tab.slice(1)
              return `
                <div class="tab-item ${activeClass}" data-tab="${tab}">
                  <button class="tab-button ${activeClass}" data-tab="${tab}">${label}</button>
                  <button class="tab-tts" data-tab="${tab}" aria-label="Listen to ${label}" title="Listen to ${label}">${SPEAKER_SVG}</button>
                </div>
              `
            }).join('')}
          </div>
        `

        const panelsHtml = `
          <div class="tab-panels">
            ${tabs.map((tab, idx) => {
              const activeClass = idx === 0 ? 'active' : ''
              const textVal = tab === 'history' ? poi.history : (tab === 'folklore' ? poi.folklore : poi.culture_note)
              return `
                <section class="tab-panel ${activeClass}" id="tab-${tab}">
                  <p>${textVal}</p>
                </section>
              `
            }).join('')}
          </div>
        `

        return tabsHtml + panelsHtml
      })()}
    `

    const tabButtons = content.querySelectorAll('.tab-button')
    const tabPanels = content.querySelectorAll('.tab-panel')

    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const targetTab = button.getAttribute('data-tab')

        if (activeTtsTab !== null) {
          stopSpeech()
          activeTtsTab = null
        }

        tabButtons.forEach(btn => btn.classList.remove('active'))
        tabPanels.forEach(panel => panel.classList.remove('active'))
        content.querySelectorAll('.tab-item').forEach(item => item.classList.remove('active'))

        button.classList.add('active')
        const tabItem = button.closest('.tab-item')
        tabItem?.classList.add('active')
        const activePanel = content.querySelector(`#tab-${targetTab}`)
        activePanel?.classList.add('active')
      })
    })

    const ttsButtons = content.querySelectorAll('.tab-tts')
    console.log("UI: Found", ttsButtons.length, "TTS buttons in info card content to attach click listeners.");
    ttsButtons.forEach(ttsBtn => {
      ttsBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        const tabName = ttsBtn.getAttribute('data-tab')
        console.log("UI: TTS button clicked. tabName:", tabName, "activeTtsTab:", activeTtsTab);
        if (!tabName) {
          console.error("UI: Clicked TTS button has no data-tab attribute!");
          return;
        }

        if (activeTtsTab === tabName) {
          console.log("UI: Clicked tab is already active. Stopping speech.");
          stopSpeech()
          activeTtsTab = null
          return
        }

        const panel = content.querySelector(`#tab-${tabName}`) as HTMLElement | null
        console.log("UI: Selected panel element:", panel);
        const textToSpeak = panel?.innerText || panel?.textContent || ''
        console.log("UI: Extracted text length:", textToSpeak.length, "Snippet:", textToSpeak.substring(0, 60));
        
        if (!textToSpeak) {
          console.warn("UI: Aborting speak call because textToSpeak is empty.");
          return
        }

        console.log("UI: Triggering speak() via tts.ts...");
        speak(
          textToSpeak,
          () => {
            console.log("UI Callback: onStart fired for tab:", tabName);
            activeTtsTab = tabName
            ttsButtons.forEach(btn => {
              const btnTab = btn.getAttribute('data-tab')
              if (btnTab === tabName) {
                console.log("UI: Changing button to PAUSE icon for:", btnTab);
                btn.innerHTML = PAUSE_SVG
                btn.classList.add('is-speaking')
                btn.setAttribute('aria-label', `Stop listening to ${btnTab}`)
              } else {
                btn.innerHTML = SPEAKER_SVG
                btn.classList.remove('is-speaking')
                btn.setAttribute('aria-label', `Listen to ${btnTab}`)
              }
            })
          },
          () => {
            console.log("UI Callback: onEnd fired for tab:", tabName);
            activeTtsTab = null
            ttsButtons.forEach(btn => {
              const btnTab = btn.getAttribute('data-tab')
              console.log("UI: Resetting button to SPEAKER icon for:", btnTab);
              btn.innerHTML = SPEAKER_SVG
              btn.classList.remove('is-speaking')
              btn.setAttribute('aria-label', `Listen to ${btnTab}`)
            })
          }
        )
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
