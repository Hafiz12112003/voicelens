import { RefreshCw, WifiOff } from 'lucide-react'

export default function SnapshotBanner({ visible, onRetry }) {
  if (!visible) return null
  return (
    <div
      role="status"
      className="flex items-center gap-3 border-b border-border bg-raised px-4 py-2 text-sm md:px-6"
    >
      <WifiOff aria-hidden="true" className="size-4 shrink-0 text-medium" />
      <p className="min-w-0 flex-1 text-foreground">
        Server unreachable. You are viewing a saved read-only snapshot.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex h-8 shrink-0 items-center gap-2 rounded-md border border-input px-3 text-sm transition-colors duration-(--dur) ease-(--ease) hover:bg-accent"
      >
        <RefreshCw aria-hidden="true" className="size-4" />
        Retry
      </button>
    </div>
  )
}
