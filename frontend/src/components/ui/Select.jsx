import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils.js'

// Native <select> restyled to the tokens: best keyboard, mobile and test behaviour.
export default function Select({ label, value, onChange, className, children }) {
  return (
    <div className={cn('relative', className)}>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full appearance-none rounded-md border border-input bg-card pl-3 pr-8 text-base text-foreground transition-colors duration-(--dur) ease-(--ease) hover:bg-accent"
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  )
}
