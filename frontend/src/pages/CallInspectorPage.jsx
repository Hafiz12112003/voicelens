import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, PhoneOff } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import FindingsPanel from '@/components/calls/FindingsPanel.jsx'
import ReviewBadge from '@/components/calls/ReviewBadge.jsx'
import SourceBadge from '@/components/calls/SourceBadge.jsx'
import Timeline from '@/components/calls/Timeline.jsx'
import Transcript from '@/components/calls/Transcript.jsx'
import EmptyState from '@/components/states/EmptyState.jsx'
import ErrorState from '@/components/states/ErrorState.jsx'
import Button from '@/components/ui/Button.jsx'
import Skeleton from '@/components/ui/Skeleton.jsx'
import { useApi } from '@/hooks/useApi.js'
import { useSnapshotMode } from '@/hooks/useSnapshotMode.js'
import { formatDuration } from '@/lib/format.js'
import { orderFindings, stepFinding, timelineSegments } from '@/lib/inspector.js'
import { cn } from '@/lib/utils.js'
import { getCall } from '@/services/api.js'

const HIGHLIGHT_MS = 1200

function formatMs(ms) {
  if (ms === null || ms === undefined) return '\u2014'
  return `${Math.round(ms).toLocaleString('en-US')} ms`
}

function scrollBehavior() {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  return reduce ? 'auto' : 'smooth'
}

function isTypingTarget(target) {
  if (!target || !target.tagName) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

function Stat({ label, value, mono }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-base">
        <span className={mono ? 'mono num' : 'num'}>{value}</span>
      </dd>
    </div>
  )
}

function HeaderSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading call">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-4 h-7 w-64" />
      <Skeleton className="mt-4 h-5 w-80" />
      <Skeleton className="mt-6 h-16 w-full" />
    </div>
  )
}

function BackLink() {
  return (
    <Link
      to="/calls"
      className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      All calls
    </Link>
  )
}

export default function CallInspectorPage() {
  const { callId } = useParams()
  const fetcher = useCallback(() => getCall(callId), [callId])
  const { data, error, reload } = useApi(fetcher, callId)
  const snapshot = useSnapshotMode()

  const turnNodes = useRef(new Map())
  const timer = useRef(null)
  const [highlightedTurn, setHighlightedTurn] = useState(null)
  const [activeFindingId, setActiveFindingId] = useState(null)
  // Only used between 768px and 1279px, where one panel shows at a time.
  const [view, setView] = useState('transcript')

  const ordered = useMemo(() => orderFindings(data?.findings), [data])

  useEffect(() => () => clearTimeout(timer.current), [])

  const registerTurn = useCallback((index, node) => {
    if (node) turnNodes.current.set(index, node)
    else turnNodes.current.delete(index)
  }, [])

  // Scroll to and highlight a turn. Does not change the visible tab.
  const focusTurn = useCallback((index) => {
    const node = turnNodes.current.get(index)
    if (!node) return
    node.scrollIntoView?.({ behavior: scrollBehavior(), block: 'center' })
    setHighlightedTurn(index)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setHighlightedTurn(null), HIGHLIGHT_MS)
  }, [])

  // Same, but first shows the transcript tab and waits a frame so it is visible.
  const goToTurn = useCallback(
    (index) => {
      if (view !== 'transcript') {
        setView('transcript')
        requestAnimationFrame(() => focusTurn(index))
      } else {
        focusTurn(index)
      }
    },
    [view, focusTurn],
  )

  const clearHighlight = useCallback(() => {
    clearTimeout(timer.current)
    setHighlightedTurn(null)
    setActiveFindingId(null)
  }, [])

  // Keep the active finding card visible inside the findings panel.
  useEffect(() => {
    if (activeFindingId === null) return
    const card = document.querySelector(`[data-finding-id="${activeFindingId}"]`)
    card?.scrollIntoView?.({ behavior: scrollBehavior(), block: 'nearest' })
  }, [activeFindingId])

  // j / k step through findings, Esc clears. Ignored while typing.
  useEffect(() => {
    function onKeyDown(event) {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
      if (isTypingTarget(event.target)) return
      if (event.key === 'Escape') {
        clearHighlight()
        return
      }
      if (event.key !== 'j' && event.key !== 'k') return
      const nextId = stepFinding(ordered, activeFindingId, event.key === 'j' ? 1 : -1)
      if (nextId === null) return
      event.preventDefault()
      setActiveFindingId(nextId)
      const finding = ordered.find((item) => item.id === nextId)
      if (finding && finding.turn_index !== null && finding.turn_index !== undefined) {
        focusTurn(finding.turn_index)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [ordered, activeFindingId, focusTurn, clearHighlight])

  if (error && error.status === 404) {
    return (
      <>
        <BackLink />
        <EmptyState icon={PhoneOff} message={`No call found with ID ${callId}.`} />
      </>
    )
  }

  if (error && !data) {
    return (
      <>
        <BackLink />
        <ErrorState message={error.message} onRetry={reload} />
      </>
    )
  }

  if (!data) {
    return (
      <>
        <BackLink />
        <HeaderSkeleton />
      </>
    )
  }

  const { stats } = data
  const stale = data.call_id !== callId
  const segments = timelineSegments(data.turns, data.findings)
  return (
    <div className={stale ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
      <BackLink />
      <header>
        <h1 className="mono text-lg font-semibold">{data.call_id}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">{data.agent}</span>
          <SourceBadge source={data.source} />
          <span className="inline-flex h-5 items-center rounded-sm border border-border px-2 text-xs">
            {data.outcome}
          </span>
          <ReviewBadge status={data.review_status} />
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Duration" value={formatDuration(stats.duration_ms)} mono />
          <Stat label="Turns" value={stats.turn_count} />
          <Stat label="Findings" value={stats.finding_count} />
          <Stat label="Responses" value={stats.response_count} />
          <Stat label="Avg latency" value={formatMs(stats.avg_latency_ms)} mono />
          <Stat label="Max latency" value={formatMs(stats.max_latency_ms)} mono />
        </dl>
      </header>
      <div className="mt-4">
        <Timeline segments={segments} onSelect={goToTurn} />
      </div>
      <div role="group" aria-label="Show" className="mt-4 hidden gap-2 md:flex xl:hidden">
        <Button
          size="sm"
          variant={view === 'transcript' ? 'primary' : 'outline'}
          aria-pressed={view === 'transcript'}
          onClick={() => setView('transcript')}
        >
          Transcript
        </Button>
        <Button
          size="sm"
          variant={view === 'findings' ? 'primary' : 'outline'}
          aria-pressed={view === 'findings'}
          onClick={() => setView('findings')}
        >
          {`Findings ${ordered.length}`}
        </Button>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[3fr_2fr]">
        <div
          data-view="transcript"
          className={cn(
            'min-w-0 rounded-xl border border-border bg-card',
            view === 'findings' && 'md:max-xl:hidden',
          )}
        >
          <Transcript
            turns={data.turns}
            highlightedTurn={highlightedTurn}
            registerTurn={registerTurn}
          />
        </div>
        <FindingsPanel
          findings={data.findings}
          activeId={activeFindingId}
          readOnly={snapshot}
          className={view === 'transcript' ? 'md:max-xl:hidden' : undefined}
          onGoToTurn={goToTurn}
          onSelect={setActiveFindingId}
          onChanged={reload}
        />
      </div>
    </div>
  )
}
