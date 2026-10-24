import { cn } from '@/lib/utils.js'

const COLORS = { high: 'bg-high', medium: 'bg-medium', low: 'bg-low' }

function describe(segment) {
  const noun = segment.count === 1 ? 'finding' : 'findings'
  return `Turn ${segment.index}: ${segment.count} ${noun}, ${segment.severity} severity`
}

export default function Timeline({ segments, onSelect }) {
  if (!segments || segments.length === 0) return null
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-2 text-xs text-muted-foreground">Timeline: one segment per turn</p>
      <div role="group" aria-label="Call timeline" className="flex h-6 items-stretch gap-px">
        {segments.map((segment) =>
          segment.severity ? (
            <button
              key={segment.index}
              type="button"
              title={describe(segment)}
              aria-label={describe(segment)}
              onClick={() => onSelect(segment.index)}
              className={cn(
                'min-w-1 flex-1 rounded-sm transition-opacity duration-(--dur) ease-(--ease) hover:opacity-80',
                COLORS[segment.severity],
              )}
            />
          ) : (
            <span key={segment.index} aria-hidden="true" className="min-w-1 flex-1 rounded-sm bg-muted" />
          ),
        )}
      </div>
    </div>
  )
}
