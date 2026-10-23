import { cn } from '@/lib/utils.js'

export default function EmptyState({ icon: Icon, message, action, className }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-4 rounded-xl border border-dashed border-border-strong px-6 py-12 text-center',
        className,
      )}
    >
      {Icon && <Icon aria-hidden="true" className="size-6 text-faint" />}
      <p className="max-w-sm text-base text-muted-foreground">{message}</p>
      {action}
    </div>
  )
}
