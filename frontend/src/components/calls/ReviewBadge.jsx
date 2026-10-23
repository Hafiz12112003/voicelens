import { REVIEW_LABELS } from '@/lib/format.js'
import { cn } from '@/lib/utils.js'

const STYLES = {
  clean: 'text-muted-foreground',
  unreviewed: 'text-foreground',
  in_review: 'text-medium',
  reviewed: 'text-success',
}

export default function ReviewBadge({ status }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-sm border border-border px-2 text-xs',
        STYLES[status],
      )}
    >
      {REVIEW_LABELS[status] ?? status}
    </span>
  )
}
