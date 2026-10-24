import { sparklinePoints } from '@/lib/summary.js'
import { cn } from '@/lib/utils.js'

// Decorative trend line. The card's number carries the meaning.
export default function Sparkline({ values, className }) {
  const points = sparklinePoints(values)
  if (!points) return <div aria-hidden="true" className={cn('mt-3 h-7', className)} />
  return (
    <svg
      viewBox="0 0 100 28"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cn('mt-3 h-7 w-full text-primary', className)}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
