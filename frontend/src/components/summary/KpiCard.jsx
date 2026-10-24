import Sparkline from '@/components/summary/Sparkline.jsx'
import { cn } from '@/lib/utils.js'

export default function KpiCard({ label, value, detail, trend, mono }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-xl font-semibold tabular-nums', mono && 'mono')}>{value}</p>
      {detail && <p className="mt-1 text-sm text-muted-foreground">{detail}</p>}
      {trend !== undefined && <Sparkline values={trend} />}
    </div>
  )
}
