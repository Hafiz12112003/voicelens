import { useCallback } from 'react'
import { Gauge } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import PageHeader from '@/components/PageHeader.jsx'
import EmptyState from '@/components/states/EmptyState.jsx'
import ErrorState from '@/components/states/ErrorState.jsx'
import AccuracyTable from '@/components/summary/AccuracyTable.jsx'
import KpiCard from '@/components/summary/KpiCard.jsx'
import RuleChart from '@/components/summary/RuleChart.jsx'
import Button from '@/components/ui/Button.jsx'
import { buttonVariants } from '@/components/ui/buttonVariants.js'
import Skeleton from '@/components/ui/Skeleton.jsx'
import { useApi } from '@/hooks/useApi.js'
import { formatMs, formatPercent } from '@/lib/format.js'
import { dailySeries, plural } from '@/lib/summary.js'
import { getSummary } from '@/services/api.js'

const SOURCES = [
  { value: 'real', label: 'Real' },
  { value: 'synthetic', label: 'Synthetic' },
  { value: 'all', label: 'All' },
]

const NOTES = {
  real: 'Real demo calls only.',
  synthetic: 'Synthetic example calls written to test the rules. Not real agent behaviour.',
  all: 'Real and synthetic calls combined. Accuracy never includes synthetic calls.',
}

const EMPTY_MESSAGES = {
  real: 'No real calls imported yet. Synthetic calls are kept separate.',
  synthetic: 'No synthetic calls imported yet.',
  all: 'No calls imported yet.',
}

function SummarySkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading summary"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
    >
      {[0, 1, 2, 3, 4, 5].map((key) => (
        <Skeleton key={key} className="h-28 rounded-xl" />
      ))}
    </div>
  )
}

export default function SummaryPage() {
  const [params, setParams] = useSearchParams()
  const requested = params.get('source')
  const source = SOURCES.some((item) => item.value === requested) ? requested : 'real'
  const fetcher = useCallback(() => getSummary({ source }), [source])
  const { data, error, reload } = useApi(fetcher, source)

  function chooseSource(next) {
    setParams(next === 'real' ? {} : { source: next })
  }

  let body
  if (error) {
    body = <ErrorState message={error.message} onRetry={reload} />
  } else if (!data) {
    body = <SummarySkeleton />
  } else if (data.calls_analysed === 0) {
    body = (
      <EmptyState
        icon={Gauge}
        message={EMPTY_MESSAGES[source]}
        action={
          source === 'real' ? (
            <Button onClick={() => chooseSource('synthetic')}>Show synthetic calls</Button>
          ) : (
            <Link to="/calls" className={buttonVariants()}>
              View calls
            </Link>
          )
        }
      />
    )
  } else {
    const { findings, failure, latency, daily } = data
    const stale = data.scope?.source !== undefined && data.scope.source !== source
    body = (
      <div className={stale ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
        <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <KpiCard
            label="Calls analysed"
            value={data.calls_analysed}
            detail={`${plural(data.calls_with_latency, 'call')} with measurable latency`}
            trend={dailySeries(daily, 'calls')}
          />
          <KpiCard
            label="Findings"
            value={findings.total}
            detail={`${findings.open} open`}
            trend={dailySeries(daily, 'findings')}
          />
          <KpiCard
            label="Confirmed / dismissed"
            value={`${findings.confirmed} / ${findings.dismissed}`}
            detail={`${findings.open} still open`}
          />
          <KpiCard
            label="Failure rate"
            value={formatPercent(failure.rate)}
            detail={`Calls with a confirmed high-severity finding: ${failure.calls_with_confirmed_high} of ${data.calls_analysed}`}
          />
          <KpiCard
            label="Avg latency"
            value={formatMs(latency.avg_ms)}
            detail={`${plural(latency.count, 'response turn')} in ${plural(data.calls_with_latency, 'call')}`}
            trend={dailySeries(daily, 'avg_latency_ms')}
            mono
          />
          <KpiCard
            label="P95 latency"
            value={formatMs(latency.p95_ms)}
            detail={`Nearest rank. Max ${formatMs(latency.max_ms)}`}
            mono
          />
        </section>
        <p className="mt-4 text-sm text-muted-foreground">
          {`Escalated calls: ${data.escalated_calls}. Reported separately; they are not counted as failures.`}
        </p>
        <RuleChart perRule={data.per_rule} />
        <AccuracyTable accuracy={data.accuracy} />
      </div>
    )
  }

  return (
    <>
      <PageHeader title="Summary" description={NOTES[source]}>
        <div role="group" aria-label="Source" className="flex gap-2">
          {SOURCES.map((item) => (
            <Button
              key={item.value}
              size="sm"
              variant={source === item.value ? 'primary' : 'outline'}
              aria-pressed={source === item.value}
              onClick={() => chooseSource(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </PageHeader>
      {body}
    </>
  )
}
