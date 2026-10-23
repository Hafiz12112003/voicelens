import { useCallback, useEffect, useRef, useState } from 'react'
import { isSnapshotMode, subscribeMode } from '@/services/api.js'

// Runs `fetcher` whenever `key` changes. While a new request is in flight the
// previous data stays available, so screens can dim it instead of flashing.
export function useApi(fetcher, key) {
  const [result, setResult] = useState(null)
  const [token, setToken] = useState(0)
  const fetcherRef = useRef(fetcher)

  useEffect(() => {
    fetcherRef.current = fetcher
  })

  useEffect(() => {
    let cancelled = false
    Promise.resolve()
      .then(() => fetcherRef.current())
      .then(
        (data) => {
          if (!cancelled) setResult({ key, token, data, error: null })
        },
        (error) => {
          if (!cancelled) {
            setResult((previous) => ({ key, token, data: previous?.data ?? null, error }))
          }
        },
      )
    return () => {
      cancelled = true
    }
  }, [key, token])

  // When the live API comes back (Retry in the banner), load again.
  useEffect(
    () =>
      subscribeMode(() => {
        if (!isSnapshotMode()) setToken((value) => value + 1)
      }),
    [],
  )

  const reload = useCallback(() => setToken((value) => value + 1), [])
  const current = result !== null && result.key === key && result.token === token

  return {
    data: result ? result.data : null,
    error: current ? result.error : null,
    loading: !current,
    reload,
  }
}
