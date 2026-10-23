import { Link, useNavigate } from 'react-router-dom'
import ReviewBadge from '@/components/calls/ReviewBadge.jsx'
import SeverityDot from '@/components/calls/SeverityDot.jsx'
import SourceBadge from '@/components/calls/SourceBadge.jsx'
import Skeleton from '@/components/ui/Skeleton.jsx'
import { formatDuration } from '@/lib/format.js'

const CARD = 'flex flex-col gap-3 rounded-xl border border-border bg-card p-4'

function SkeletonCard() {
  return (
    <li className={CARD}>
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-16" />
      </div>
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-5 w-20" />
    </li>
  )
}

function CallCard({ call }) {
  const navigate = useNavigate()
  const href = `/calls/${encodeURIComponent(call.call_id)}`

  return (
    <li
      onClick={() => navigate(href)}
      className={`${CARD} cursor-pointer transition-colors duration-(--dur) ease-(--ease) hover:bg-accent`}
    >
      <div className="flex items-center justify-between gap-3">
        <Link
          to={href}
          onClick={(event) => event.stopPropagation()}
          className="mono text-sm text-foreground hover:text-primary"
        >
          {call.call_id}
        </Link>
        <SourceBadge source={call.source} />
      </div>
      <p className="text-base text-muted-foreground">{call.agent}</p>
      <dl className="grid grid-cols-3 gap-3">
        <div>
          <dt className="text-xs text-muted-foreground">Duration</dt>
          <dd className="text-base tabular-nums">{formatDuration(call.duration_ms)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Findings</dt>
          <dd className="text-base tabular-nums">{call.findings_count}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Severity</dt>
          <dd className="text-sm">
            <SeverityDot severity={call.max_severity} />
          </dd>
        </div>
      </dl>
      <div>
        <ReviewBadge status={call.review_status} />
      </div>
    </li>
  )
}

// Below 768px the table becomes cards. calls === null renders the skeleton.
export default function CallCards({ calls }) {
  if (calls === null) {
    return (
      <ul aria-hidden="true" className="flex flex-col gap-3 md:hidden">
        {Array.from({ length: 4 }, (_, index) => (
          <SkeletonCard key={index} />
        ))}
      </ul>
    )
  }
  return (
    <ul aria-label="Calls" className="flex flex-col gap-3 md:hidden">
      {calls.map((call) => (
        <CallCard key={call.call_id} call={call} />
      ))}
    </ul>
  )
}
