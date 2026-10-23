import { useSyncExternalStore } from 'react'
import { isSnapshotMode, subscribeMode } from '@/services/api.js'

// True while reads are served from the bundled snapshot because the API is down.
export function useSnapshotMode() {
  return useSyncExternalStore(subscribeMode, isSnapshotMode)
}
