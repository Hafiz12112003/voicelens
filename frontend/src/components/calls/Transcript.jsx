import { forwardRef } from 'react'
import { Bot, User } from 'lucide-react'
import { formatDuration } from '@/lib/format.js'
import { SLOW_GAP_MS, gapBarRatio } from '@/lib/inspector.js'
import { cn } from '@/lib/utils.js'

function formatLatency(ms) {
  return `${Math.round(ms).toLocaleString('en-US')} ms`
}

function Avatar({ speaker }) {
  const isAgent = speaker === 'agent'
  const Icon = isAgent ? Bot : User
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-8 shrink-0 place-items-center rounded-full border border-border',
        isAgent ? 'bg-accent text-primary' : 'bg-muted text-muted-foreground',
      )}
    >
      <Icon className="size-4" />
    </span>
  )
}

function LatencyChip({ latencyMs }) {
  if (typeof latencyMs !== 'number' || latencyMs < 0) return null
  const slow = latencyMs > SLOW_GAP_MS
  const ratio = gapBarRatio(latencyMs)
  return (
    <div className="mt-2 flex items-center gap-2">
      <span
        className={cn(
          'mono num inline-flex h-5 items-center rounded-sm border px-2 text-xs',
          slow ? 'border-medium text-medium' : 'border-border text-muted-foreground',
        )}
      >
        {formatLatency(latencyMs)}
        <span className="sr-only">{slow ? ' response time, slow' : ' response time'}</span>
      </span>
      {slow && (
        <span aria-hidden="true" className="h-1 w-24 overflow-hidden rounded-sm bg-muted">
          <span className="block h-full bg-medium" style={{ width: `${ratio * 100}%` }} />
        </span>
      )}
    </div>
  )
}

const TurnRow = forwardRef(function TurnRow({ turn, highlighted }, ref) {
  const label = turn.speaker === 'agent' ? 'Agent' : 'Customer'
  return (
    <li
      ref={ref}
      data-turn={turn.i}
      className={cn(
        'flex gap-3 border-l-2 px-3 py-3 transition-colors duration-(--dur) ease-(--ease)',
        highlighted ? 'border-primary bg-accent' : 'border-transparent',
      )}
    >
      <Avatar speaker={turn.speaker} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{label}</span>
          <span className="mono num">{formatDuration(turn.start_ms)}</span>
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words text-base">{turn.text}</p>
        <LatencyChip latencyMs={turn.latency_ms} />
      </div>
    </li>
  )
})

export default function Transcript({ turns, highlightedTurn, registerTurn }) {
  if (!turns || turns.length === 0) {
    return <p className="p-4 text-base text-muted-foreground">This call has no turns.</p>
  }
  return (
    <ol aria-label="Transcript" className="divide-y divide-border">
      {turns.map((turn) => (
        <TurnRow
          key={turn.i}
          turn={turn}
          highlighted={highlightedTurn === turn.i}
          ref={registerTurn ? (node) => registerTurn(turn.i, node) : undefined}
        />
      ))}
    </ol>
  )
}
