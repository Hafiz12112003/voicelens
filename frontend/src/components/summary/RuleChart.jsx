import { CircleCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import EmptyState from '@/components/states/EmptyState.jsx'
import { buttonVariants } from '@/components/ui/buttonVariants.js'
import { ruleLabel } from '@/lib/format.js'

const SERIES = [
  { key: 'open', label: 'Open', color: 'var(--accent)', swatch: 'bg-primary' },
  { key: 'confirmed', label: 'Confirmed', color: 'var(--success)', swatch: 'bg-success' },
  { key: 'dismissed', label: 'Dismissed', color: 'var(--low)', swatch: 'bg-low' },
]

const ROW_HEIGHT = 40
const AXIS_HEIGHT = 32
// Wide enough for the longest rule label ("Customer repeated themselves").
const LABEL_WIDTH = 188
const TICK = { fill: 'var(--text-muted)', fontSize: 12 }
const TOOLTIP_STYLE = {
  background: 'var(--raised)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 13,
}

export default function RuleChart({ perRule }) {
  const rows = (perRule || []).map((item) => ({
    rule: item.rule,
    label: ruleLabel(item.rule),
    open: item.open,
    confirmed: item.confirmed,
    dismissed: item.dismissed,
    total: item.total,
  }))
  const hasFindings = rows.some((row) => row.total > 0)
  // The chart needs ResizeObserver (every real browser has it; jsdom does not).
  const canDraw = typeof ResizeObserver !== 'undefined'

  return (
    <section
      aria-labelledby="rule-chart-title"
      className="mt-6 rounded-xl border border-border bg-card p-4"
    >
      <h2 id="rule-chart-title" className="text-md font-semibold">
        Findings per rule
      </h2>
      {!hasFindings ? (
        <EmptyState
          icon={CircleCheck}
          message="No findings for this source."
          action={
            <Link to="/calls" className={buttonVariants()}>
              View calls
            </Link>
          }
        />
      ) : (
        <>
          <ul
            aria-label="Legend"
            className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground"
          >
            {SERIES.map((series) => (
              <li key={series.key} className="flex items-center gap-2">
                <span aria-hidden="true" className={`size-2 rounded-full ${series.swatch}`} />
                {series.label}
              </li>
            ))}
          </ul>
          {canDraw && (
            <div
              aria-hidden="true"
              className="mt-3"
              style={{ height: rows.length * ROW_HEIGHT + AXIS_HEIGHT }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={rows}
                  layout="vertical"
                  margin={{ top: 4, right: 12, bottom: 0, left: 0 }}
                  accessibilityLayer={false}
                >
                  <CartesianGrid horizontal={false} stroke="var(--border)" />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={TICK}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={LABEL_WIDTH}
                    interval={0}
                    tick={TICK}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--accent-soft)' }}
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={{ color: 'var(--text)' }}
                    itemStyle={{ color: 'var(--text)' }}
                  />
                  {SERIES.map((series) => (
                    <Bar
                      key={series.key}
                      dataKey={series.key}
                      name={series.label}
                      stackId="findings"
                      fill={series.color}
                      barSize={16}
                      isAnimationActive={false}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <table className="sr-only">
            <caption>Findings per rule by review status</caption>
            <thead>
              <tr>
                <th scope="col">Rule</th>
                <th scope="col">Open</th>
                <th scope="col">Confirmed</th>
                <th scope="col">Dismissed</th>
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.rule}>
                  <th scope="row">{row.label}</th>
                  <td>{row.open}</td>
                  <td>{row.confirmed}</td>
                  <td>{row.dismissed}</td>
                  <td>{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  )
}
