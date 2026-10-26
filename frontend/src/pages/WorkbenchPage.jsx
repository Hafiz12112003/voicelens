import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FileJson } from 'lucide-react'
import FindingsPanel from '@/components/calls/FindingsPanel.jsx'
import Lanes from '@/components/calls/Lanes.jsx'
import Transcript from '@/components/calls/Transcript.jsx'
import PageHeader from '@/components/PageHeader.jsx'
import EmptyState from '@/components/states/EmptyState.jsx'
import ErrorState from '@/components/states/ErrorState.jsx'
import Button from '@/components/ui/Button.jsx'
import Skeleton from '@/components/ui/Skeleton.jsx'
import SettingsPanel from '@/components/workbench/SettingsPanel.jsx'
import { useApi } from '@/hooks/useApi.js'
import { formatDuration, formatMs } from '@/lib/format.js'
import { orderFindings, stepFinding } from '@/lib/inspector.js'
import {
  exampleText,
  lanesThresholds,
  prepareInput,
  settingsFromFields,
  thresholdFields,
} from '@/lib/workbench.js'
import { cn } from '@/lib/utils.js'
import { analyzeCall, getRules } from '@/services/api.js'

const DEBOUNCE_MS = 400
const HIGHLIGHT_MS = 1200
const NO_OVERRIDES = {}

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

function ResultSkeleton() {
  return (
    <div aria-busy="true" aria-label="Analysing" className="flex flex-col gap-4">
      <Skeleton className="h-20 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  )
}

function Problem({ message, details }) {
  return (
    <div role="alert" className="rounded-xl border border-border bg-card p-4 text-sm">
      <p className="font-medium">{message}</p>
      {details && details.length > 0 && (
        <ul
          aria-label="Validation problems"
          className="mt-2 flex list-disc flex-col gap-1 pl-5 text-muted-foreground"
        >
          {details.map((detail, index) => (
            <li key={`${index}-${detail}`} className="break-words">
              {detail}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function WorkbenchPage() {
  const [text, setText] = useState('')
  const [debounced, setDebounced] = useState('')
  const [overrides, setOverrides] = useState(NO_OVERRIDES)
  const [debouncedOverrides, setDebouncedOverrides] = useState(NO_OVERRIDES)
  const inputRef = useRef(null)
  const turnNodes = useRef(new Map())
  const timer = useRef(null)
  const [highlightedTurn, setHighlightedTurn] = useState(null)
  const [activeFindingId, setActiveFindingId] = useState(null)
  const [fileProblem, setFileProblem] = useState(null)

  // Typing in the editor and changing a setting share one debounce.
  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(text)
      setDebouncedOverrides(overrides)
    }, DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [text, overrides])

  useEffect(() => () => clearTimeout(timer.current), [])

  const rulesState = useApi(getRules, 'rules')
  const rulesData = rulesState.data
  const fields = useMemo(() => thresholdFields(rulesData?.rules), [rulesData])
  const changed = Object.values(overrides).some((value) => String(value).trim() !== '')

  const panelSettings = useMemo(() => settingsFromFields(debouncedOverrides), [debouncedOverrides])
  const prepared = useMemo(() => prepareInput(debounced, panelSettings), [debounced, panelSettings])
  const requestKey = `${debounced}\u0000${JSON.stringify(panelSettings)}`
  const fetcher = useCallback(
    () => (prepared.status === 'ok' ? analyzeCall(prepared.payload) : Promise.resolve(null)),
    [prepared],
  )
  const { data, error, loading, reload } = useApi(fetcher, requestKey)

  const visible = prepared.status === 'ok' && !error && data ? data : null
  const ordered = useMemo(() => orderFindings(visible?.findings), [visible])
  const used = visible?.settings
  const thresholds = useMemo(() => lanesThresholds(used), [used])
  const pending = text !== debounced || overrides !== debouncedOverrides
  const dim = pending || (loading && visible !== null)

  const registerTurn = useCallback((index, node) => {
    if (node) turnNodes.current.set(index, node)
    else turnNodes.current.delete(index)
  }, [])

  const focusTurn = useCallback((index) => {
    const node = turnNodes.current.get(index)
    if (!node) return
    node.scrollIntoView?.({ behavior: scrollBehavior(), block: 'center' })
    setHighlightedTurn(index)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setHighlightedTurn(null), HIGHLIGHT_MS)
  }, [])

  const clearHighlight = useCallback(() => {
    clearTimeout(timer.current)
    setHighlightedTurn(null)
    setActiveFindingId(null)
  }, [])

  useEffect(() => {
    if (activeFindingId === null) return
    const card = document.querySelector(`[data-finding-id="${activeFindingId}"]`)
    card?.scrollIntoView?.({ behavior: scrollBehavior(), block: 'nearest' })
  }, [activeFindingId])

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

  const changeSetting = useCallback((key, value) => {
    setOverrides((previous) => ({ ...previous, [key]: value }))
  }, [])

  function loadExample() {
    setFileProblem(null)
    setText(exampleText())
  }

  async function handleFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setFileProblem(null)
    try {
      setText(await file.text())
    } catch {
      setFileProblem('Could not read that file.')
    }
  }

  let right
  if (prepared.status === 'empty') {
    right = (
      <EmptyState
        icon={FileJson}
        message="Paste a call as JSON to see where the agent failed the customer."
        action={
          <Button variant="outline" onClick={loadExample}>
            Try the example
          </Button>
        }
      />
    )
  } else if (prepared.status === 'invalid') {
    right = <Problem message={prepared.message} />
  } else if (error && error.status === 422) {
    right = <Problem message={error.message} details={error.details} />
  } else if (error) {
    right = <ErrorState message={error.message} onRetry={reload} />
  } else if (!visible) {
    right = <ResultSkeleton />
  } else {
    const { stats } = visible
    right = (
      <div className={cn('flex flex-col gap-4 transition-opacity', dim && 'opacity-60')}>
        <dl className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-3">
          <Stat label="Duration" value={formatDuration(stats.duration_ms)} mono />
          <Stat label="Turns" value={stats.turn_count} />
          <Stat label="Findings" value={stats.finding_count} />
          <Stat label="Responses" value={stats.response_count} />
          <Stat label="Avg latency" value={formatMs(stats.avg_latency_ms)} mono />
          <Stat label="Max latency" value={formatMs(stats.max_latency_ms)} mono />
        </dl>
        {used && (
          <p className="mono break-words text-xs text-muted-foreground">
            {`Settings used: ${Object.entries(used)
              .map(([key, value]) => `${key} ${value}`)
              .join(', ')}`}
          </p>
        )}
        <FindingsPanel
          findings={visible.findings}
          activeId={activeFindingId}
          readOnly={false}
          reviewActions={false}
          showStatus={false}
          sticky={false}
          className="max-h-[24rem] overflow-y-auto"
          onGoToTurn={focusTurn}
          onSelect={setActiveFindingId}
          onChanged={() => {}}
        />
        <div data-view="transcript" className="min-w-0 rounded-xl border border-border bg-card">
          <Transcript
            turns={visible.turns}
            highlightedTurn={highlightedTurn}
            registerTurn={registerTurn}
          />
        </div>
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title="Try it"
        description="Paste one call transcript and see which rules flag it. Nothing is saved."
      />
      {visible && (
        <div className={cn('mb-4 transition-opacity', dim && 'opacity-60')}>
          <Lanes turns={visible.turns} thresholds={thresholds} onSelectTurn={focusTurn} />
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4 self-start">
          <section
            aria-labelledby="wb-input-title"
            className="min-w-0 rounded-xl border border-border bg-card p-4"
          >
            <h2 id="wb-input-title" className="text-md font-semibold">
              Input
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={loadExample}>
                Load example
              </Button>
              <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
                Upload .json
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={text === ''}
                onClick={() => {
                  setFileProblem(null)
                  setText('')
                }}
              >
                Clear
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept=".json"
                aria-label="JSON file"
                tabIndex={-1}
                className="hidden"
                onChange={handleFile}
              />
            </div>
            <label htmlFor="wb-input" className="sr-only">
              Call JSON
            </label>
            <textarea
              id="wb-input"
              rows={24}
              value={text}
              spellCheck={false}
              onChange={(event) => setText(event.target.value)}
              className="mono mt-3 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            />
            {fileProblem && (
              <p role="alert" className="mt-2 text-sm">
                {fileProblem}
              </p>
            )}
            <p className="mt-3 text-sm text-muted-foreground">
              {'Nothing you paste is saved. call_id, agent and source are optional here. Limits: 500 turns, 256 KB. The example is synthetic, and the rules are not validated on real calls.'}
            </p>
          </section>
          <SettingsPanel
            fields={fields}
            values={overrides}
            changed={changed}
            loading={!rulesData && !rulesState.error}
            error={rulesData ? null : rulesState.error}
            onChange={changeSetting}
            onReset={() => setOverrides(NO_OVERRIDES)}
            onRetry={rulesState.reload}
          />
        </div>
        <div className="min-w-0">{right}</div>
      </div>
    </>
  )
}
