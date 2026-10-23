import { SEVERITY_LABELS } from '@/lib/format.js'
import { cn } from '@/lib/utils.js'

const DOT_COLORS = { high: 'bg-high', medium: 'bg-medium', low: 'bg-low' }

export default function SeverityDot({ severity }) {
  if (!severity) {
    return (
      <span className="text-muted-foreground">
        <span aria-hidden="true">{'\u2014'}</span>
        <span className="sr-only">No findings</span>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden="true" className={cn('size-2 rounded-full', DOT_COLORS[severity])} />
      <span className="text-muted-foreground">{SEVERITY_LABELS[severity]}</span>
    </span>
  )
}
