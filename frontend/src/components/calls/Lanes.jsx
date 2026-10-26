import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import Button from '@/components/ui/Button.jsx'
import { formatMs } from '@/lib/format.js'
import {
  MIN_WINDOW_MS,
  buildLanes,
  clampView,
  formatSeconds,
  niceTicks,
  panView,
  zoomView,
} from '@/lib/lanes.js'
import { plural } from '@/lib/summary.js'
import { cn } from '@/lib/utils.js'

const W = 1000
const PAD_L = 76
const PAD_R = 12
const PLOT_W = W - PAD_L - PAD_R
const AGENT_Y = 20
const LANE_H = 32
const GAP_Y = 60
const GAP_H = 12
const CUST_Y = 80
const AXIS_Y = 124
const H = 150

export default function Lanes({ turns, thresholds, onSelectTurn }) {
  const lanes = useMemo(() => buildLanes(turns, thresholds), [turns, thresholds])
  const [requested, setRequested] = useState(null)
  const { slowMs, highMs } = lanes.thresholds
  const custom = thresholds !== undefined && thresholds !== null

  const duration = lanes.duration
  const full = { start: 0, end: duration }
  const view = lanes.hasTimes ? clampView(requested || full, duration) : full
  const span = view.end - view.start
  const atFull = view.start <= 0 && view.end >= duration
  const atMin = span <= Math.min(MIN_WINDOW_MS, duration)

  const x = (ms) => PAD_L + ((ms - view.start) / span) * PLOT_W
  function segment(from, to) {
    if (to < view.start || from > view.end) return null
    const a = x(Math.max(from, view.start))
    const b = x(Math.min(to, view.end))
    return { x: a, width: Math.max(b - a, 2) }
  }

  const zoomIn = () => setRequested(zoomView(view, duration, 0.5))
  const zoomOut = () => setRequested(zoomView(view, duration, 2))
  const panLeft = () => setRequested(panView(view, duration, -0.25))
  const panRight = () => setRequested(panView(view, duration, 0.25))
  const reset = () => setRequested(null)

  function onKeyDown(event) {
    if (event.ctrlKey || event.metaKey || event.altKey || !lanes.hasTimes) return
    const handlers = {
      '+': zoomIn,
      '=': zoomIn,
      '-': zoomOut,
      _: zoomOut,
      ArrowLeft: panLeft,
      ArrowRight: panRight,
      0: reset,
    }
    const handler = handlers[event.key]
    if (!handler) return
    event.preventDefault()
    handler()
  }

  const slowCount = lanes.gaps.filter((gap) => gap.level !== 'ok').length
  const thresholdText = custom
    ? `${formatSeconds(slowMs)} and ${formatSeconds(highMs)}, the thresholds used for this analysis`
    : `${formatSeconds(slowMs)} and ${formatSeconds(highMs)}, the default rule thresholds. If the server was set to other thresholds, the ticks will not match`

  return (
    <section
      aria-label="Conversation lanes"
      className="relative rounded-xl border border-border bg-card p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-md font-semibold">Conversation lanes</h2>
        {lanes.hasTimes && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" aria-label="Zoom in" title="Zoom in" disabled={atMin} onClick={zoomIn}>
              <ZoomIn className="size-4" aria-hidden="true" />
            </Button>
            <Button size="sm" variant="outline" aria-label="Zoom out" title="Zoom out" disabled={atFull} onClick={zoomOut}>
              <ZoomOut className="size-4" aria-hidden="true" />
            </Button>
            <Button size="sm" variant="outline" aria-label="Pan left" title="Pan left" disabled={view.start <= 0} onClick={panLeft}>
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Button>
            <Button size="sm" variant="outline" aria-label="Pan right" title="Pan right" disabled={view.end >= duration} onClick={panRight}>
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
            <Button size="sm" variant="ghost" aria-label="Reset view" title="Reset view" disabled={atFull} onClick={reset}>
              <RotateCcw className="size-4" aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>

      {!lanes.hasTimes ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No timestamps in this call, so the lanes cannot be drawn. Add start_ms and end_ms to each turn.
        </p>
      ) : (
        <>
          <p role="status" className="mono mt-2 text-xs text-muted-foreground">
            {`Showing ${formatSeconds(view.start)} to ${formatSeconds(view.end)}`}
          </p>
          <p className="sr-only">
            {`${plural(lanes.bars.length, 'turn')} drawn. ${plural(slowCount, 'response')} slower than ${formatMs(slowMs)}.`}
          </p>
          <div
            role="group"
            aria-label="Lanes view. Plus and minus zoom, left and right arrows pan, 0 resets."
            tabIndex={0}
            onKeyDown={onKeyDown}
            className="mt-2 overflow-x-auto rounded-md"
          >
            <svg
              role="group"
              aria-label="Turns by speaker over time"
              viewBox={`0 0 ${W} ${H}`}
              style={{ minWidth: 640, width: '100%', height: 'auto' }}
            >
              <rect x={PAD_L} y={AGENT_Y} width={PLOT_W} height={LANE_H} rx={3} className="fill-current text-raised" />
              <rect x={PAD_L} y={CUST_Y} width={PLOT_W} height={LANE_H} rx={3} className="fill-current text-raised" />
              <text x={PAD_L - 8} y={AGENT_Y + 20} textAnchor="end" fontSize={12} className="fill-current text-muted-foreground">
                Agent
              </text>
              <text x={PAD_L - 8} y={GAP_Y + 10} textAnchor="end" fontSize={12} className="fill-current text-muted-foreground">
                Gap
              </text>
              <text x={PAD_L - 8} y={CUST_Y + 20} textAnchor="end" fontSize={12} className="fill-current text-muted-foreground">
                Customer
              </text>

              <line x1={PAD_L} x2={W - PAD_R} y1={AXIS_Y} y2={AXIS_Y} className="stroke-current text-border-strong" />
              {niceTicks(view.start, view.end).map((tick) => (
                <g key={tick}>
                  <line x1={x(tick)} x2={x(tick)} y1={AXIS_Y} y2={AXIS_Y + 4} className="stroke-current text-border-strong" />
                  <text x={x(tick)} y={AXIS_Y + 20} textAnchor="middle" fontSize={12} className="mono fill-current text-muted-foreground">
                    {formatSeconds(tick)}
                  </text>
                </g>
              ))}

              {lanes.gaps.map((gap) => {
                const seg = segment(gap.from, gap.to)
                if (!seg) return null
                const tone =
                  gap.level === 'high'
                    ? 'text-high'
                    : gap.level === 'slow'
                      ? 'text-medium'
                      : 'text-muted-foreground opacity-60'
                return (
                  <g key={gap.i}>
                    <rect x={seg.x} y={GAP_Y} width={seg.width} height={GAP_H} rx={2} className={cn('fill-current', tone)} />
                    {[slowMs, highMs]
                      .filter((t) => gap.ms > t)
                      .map((t, index) => {
                        const at = gap.from + t
                        if (at < view.start || at > view.end) return null
                        return (
                          <line
                            key={index}
                            x1={x(at)}
                            x2={x(at)}
                            y1={GAP_Y - 2}
                            y2={GAP_Y + GAP_H + 2}
                            strokeDasharray="2 2"
                            className="stroke-current text-foreground"
                          />
                        )
                      })}
                    <title>{`Response gap before turn ${gap.i}: ${formatMs(gap.ms)}`}</title>
                  </g>
                )
              })}

              {lanes.bars.map((bar) => {
                const seg = segment(bar.start, bar.end)
                if (!seg) return null
                const isAgent = bar.speaker === 'agent'
                const label = `Turn ${bar.i}, ${bar.speaker}, ${formatSeconds(bar.start)} to ${formatSeconds(bar.end)}`
                const select = () => {
                  if (onSelectTurn) onSelectTurn(bar.i)
                }
                return (
                  <g
                    key={bar.i}
                    role="button"
                    tabIndex={0}
                    aria-label={label}
                    className="group cursor-pointer outline-none"
                    onClick={select}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        select()
                      }
                    }}
                  >
                    <rect
                      x={seg.x}
                      y={isAgent ? AGENT_Y : CUST_Y}
                      width={seg.width}
                      height={LANE_H}
                      rx={3}
                      strokeWidth={2}
                      className={cn(
                        'fill-current stroke-transparent group-focus-visible:stroke-foreground',
                        isAgent ? 'text-primary' : 'text-muted-foreground',
                      )}
                    />
                    <title>{label}</title>
                  </g>
                )
              })}

              {lanes.overlaps.map((overlap) => {
                const seg = segment(overlap.from, overlap.to)
                if (!seg) return null
                return (
                  <rect
                    key={`${overlap.a}-${overlap.b}`}
                    aria-hidden="true"
                    x={seg.x}
                    y={AGENT_Y}
                    width={seg.width}
                    height={CUST_Y + LANE_H - AGENT_Y}
                    className="pointer-events-none fill-current text-high opacity-30"
                  />
                )
              })}
            </svg>
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            {`Bars are turns. The Gap row runs from the customer finishing to the agent starting. Dashed ticks in a gap mark ${thresholdText}. Red shading is both speaking at once.`}
          </p>
          {lanes.skipped > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {`${lanes.skipped} ${lanes.skipped === 1 ? 'turn has' : 'turns have'} no timestamps and ${lanes.skipped === 1 ? 'is' : 'are'} not drawn.`}
            </p>
          )}
        </>
      )}
    </section>
  )
}
