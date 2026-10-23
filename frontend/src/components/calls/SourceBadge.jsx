import { cn } from '@/lib/utils.js'

export default function SourceBadge({ source }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-sm px-2 text-xs',
        source === 'real'
          ? 'bg-accent text-primary'
          : 'border border-dashed border-border-strong text-muted-foreground',
      )}
    >
      {source}
    </span>
  )
}
