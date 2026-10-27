import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { THEME_KEY, getTheme, initTheme, setTheme, subscribeTheme } from '@/lib/theme.js'

const root = document.documentElement

// A fake prefers-color-scheme query. set() changes the setting and fires the handlers.
function mockSystem(light) {
  const state = { light }
  const handlers = []
  window.matchMedia = vi.fn().mockImplementation(() => ({
    get matches() {
      return state.light
    },
    addEventListener: (_type, handler) => handlers.push(handler),
    removeEventListener: () => {},
  }))
  return {
    set(value) {
      state.light = value
      handlers.forEach((handler) => handler())
    },
  }
}

beforeEach(() => {
  root.className = ''
})

afterEach(() => {
  delete window.matchMedia
  root.className = ''
})

describe('theme', () => {
  it('starts from the system setting when nothing is saved', () => {
    mockSystem(true)
    initTheme()
    expect(getTheme()).toBe('light')
    expect(root).toHaveClass('light')
    expect(root).not.toHaveClass('dark')
    expect(localStorage.getItem(THEME_KEY)).toBeNull()
    mockSystem(false)
    initTheme()
    expect(getTheme()).toBe('dark')
    expect(root).toHaveClass('dark')
  })

  it('prefers a saved choice over the system setting and ignores a bad saved value', () => {
    localStorage.setItem(THEME_KEY, 'dark')
    mockSystem(true)
    initTheme()
    expect(getTheme()).toBe('dark')
    localStorage.setItem(THEME_KEY, 'blue')
    initTheme()
    expect(getTheme()).toBe('light')
  })

  it('applies, saves and announces a chosen theme, and ignores unknown ones', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeTheme(listener)
    setTheme('light')
    expect(root).toHaveClass('light')
    expect(localStorage.getItem(THEME_KEY)).toBe('light')
    expect(listener).toHaveBeenCalledTimes(1)
    setTheme('blue')
    expect(getTheme()).toBe('light')
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    setTheme('dark')
    expect(getTheme()).toBe('dark')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('follows changes of the system setting only until a choice is saved', () => {
    const system = mockSystem(false)
    initTheme()
    expect(getTheme()).toBe('dark')
    system.set(true)
    expect(getTheme()).toBe('light')
    setTheme('dark')
    system.set(false)
    system.set(true)
    expect(getTheme()).toBe('dark')
  })

  it('still applies the theme when storage is blocked', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    try {
      setTheme('light')
      expect(getTheme()).toBe('light')
    } finally {
      spy.mockRestore()
    }
  })
})
