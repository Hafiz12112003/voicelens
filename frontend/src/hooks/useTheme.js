import { useCallback, useSyncExternalStore } from 'react'
import { getTheme, setTheme, subscribeTheme } from '@/lib/theme.js'

// The current theme ("dark" or "light") and a function that switches it.
export function useTheme() {
  const theme = useSyncExternalStore(subscribeTheme, getTheme)
  const toggle = useCallback(() => setTheme(theme === 'light' ? 'dark' : 'light'), [theme])
  return { theme, toggle }
}
