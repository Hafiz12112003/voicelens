import { useSyncExternalStore } from 'react'
import { getMode, isSnapshotMode, subscribeMode } from '@/services/api.js'

// True when the server runs with READ_ONLY=1 (the public deploy).
// The answer is fetched once and shared by every component that uses the hook.
// If the server cannot be reached, the answer stays "no" and is asked again later.
let known = null
let pending = null
const listeners = new Set()

function notify() {
  listeners.forEach((listener) => listener())
}

function load() {
  if (known !== null || pending || isSnapshotMode()) return
  pending = Promise.resolve()
    .then(() => getMode())
    .then(
      (body) => {
        known = Boolean(body && body.read_only)
      },
      () => {},
    )
    .then(() => {
      pending = null
      notify()
    })
}

function subscribe(listener) {
  listeners.add(listener)
  load()
  // When the live API comes back (Retry in the banner), ask again.
  const stopMode = subscribeMode(() => {
    if (!isSnapshotMode()) load()
  })
  return () => {
    listeners.delete(listener)
    stopMode()
  }
}

function getSnapshot() {
  return known === true
}

export function useReadOnly() {
  return useSyncExternalStore(subscribe, getSnapshot)
}

// Tests only: forget the cached answer.
export function resetReadOnlyForTests() {
  known = null
  pending = null
  notify()
}
