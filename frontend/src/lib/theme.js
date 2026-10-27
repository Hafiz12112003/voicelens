export const THEME_KEY = 'voicelens.theme'

const listeners = new Set()

function isTheme(value) {
  return value === 'light' || value === 'dark'
}

export function getStoredTheme() {
  try {
    const value = localStorage.getItem(THEME_KEY)
    return isTheme(value) ? value : null
  } catch {
    return null
  }
}

export function getSystemTheme() {
  return window.matchMedia?.('(prefers-color-scheme: light)')?.matches ? 'light' : 'dark'
}

// The class on <html> is the single source of truth ("dark" unless "light" is set).
export function getTheme() {
  return document.documentElement.classList.contains('light') ? 'light' : 'dark'
}

function apply(theme) {
  const root = document.documentElement
  root.classList.remove('dark', 'light')
  root.classList.add(theme)
}

function notify() {
  listeners.forEach((listener) => listener())
}

export function subscribeTheme(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// A choice made with the toggle: applied, remembered and announced.
export function setTheme(theme) {
  if (!isTheme(theme)) return
  apply(theme)
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // Storage can be blocked; the choice then lasts for this visit only.
  }
  notify()
}

// Run once at start: the saved choice, else the system setting. While nothing is
// saved, the app keeps following the system setting.
export function initTheme() {
  apply(getStoredTheme() ?? getSystemTheme())
  notify()
  const query = window.matchMedia?.('(prefers-color-scheme: light)')
  if (query?.addEventListener) {
    query.addEventListener('change', () => {
      if (getStoredTheme() === null) {
        apply(getSystemTheme())
        notify()
      }
    })
  }
}
