import { useState } from 'react'
import { ArrowRight, Inbox } from 'lucide-react'
import FindingsPanel from '@/components/calls/FindingsPanel.jsx'
import Lanes from '@/components/calls/Lanes.jsx'
import ReviewBadge from '@/components/calls/ReviewBadge.jsx'
import SeverityDot from '@/components/calls/SeverityDot.jsx'
import SourceBadge from '@/components/calls/SourceBadge.jsx'
import Timeline from '@/components/calls/Timeline.jsx'
import Transcript from '@/components/calls/Transcript.jsx'
import PageHeader from '@/components/PageHeader.jsx'
import EmptyState from '@/components/states/EmptyState.jsx'
import ErrorState from '@/components/states/ErrorState.jsx'
import KpiCard from '@/components/summary/KpiCard.jsx'
import Button from '@/components/ui/Button.jsx'
import Select from '@/components/ui/Select.jsx'
import Skeleton from '@/components/ui/Skeleton.jsx'
import { useTheme } from '@/hooks/useTheme.js'
import { formatRatio } from '@/lib/colors.js'
import { SAMPLE_FINDINGS, SAMPLE_TURNS } from '@/lib/designSamples.js'
import { TOKEN_GROUPS, TOKEN_ROLES, evaluatePairs, readThemeTokens } from '@/lib/designTokens.js'
import { timelineSegments } from '@/lib/inspector.js'

const noop = () => {}
const SEGMENTS = timelineSegments(SAMPLE_TURNS, SAMPLE_FINDINGS)

const TYPE_SCALE = [
  { cls: 'text-xs', px: 12, use: 'Captions, badges, hints' },
  { cls: 'text-sm', px: 13, use: 'Secondary text, small buttons' },
  { cls: 'text-base', px: 14, use: 'Body text' },
  { cls: 'text-md', px: 16, use: 'Section headings' },
  { cls: 'text-lg', px: 20, use: 'Page titles' },
  { cls: 'text-xl', px: 28, use: 'Metric values' },
]

function Section({ id, title, note, children }) {
  return (
    <section aria-labelledby={id} className="rounded-xl border border-border bg-card p-4">
      <h2 id={id} className="text-md font-semibold">
        {title}
      </h2>
      {note && <p className="mt-1 text-sm text-muted-foreground">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Swatches({ tokens }) {
  return TOKEN_GROUPS.map((group) => (
    <div key={group.title} className="mt-4 first:mt-0">
      <h3 className="text-base font-semibold">{group.title}</h3>
      <ul className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {group.tokens.map((name) => (
          <li key={name} className="flex gap-3">
            <span
              aria-hidden="true"
              className="size-10 shrink-0 rounded-md border border-border"
              style={{ background: `var(${name})` }}
            />
            <span className="min-w-0">
              <span className="mono block text-sm">{name}</span>
              <span className="mono block text-xs text-muted-foreground">{tokens[name] || 'n/a'}</span>
              <span className="block text-xs text-muted-foreground">{TOKEN_ROLES[name]}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  ))
}

function resultOf(row) {
  if (row.pass === null) return { text: 'Not measured', tone: 'text-muted-foreground' }
  if (row.pass) return { text: 'Passes', tone: 'text-success' }
  return { text: `Below ${row.need}:1`, tone: 'text-high' }
}

function ContrastTable({ rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-base">
        <caption className="sr-only">
          Measured contrast of the main colour pairs in the active theme
        </caption>
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th scope="col" className="px-3 py-2 text-left font-medium">
              Pair
            </th>
            <th scope="col" className="px-3 py-2 text-left font-medium">
              Colours
            </th>
            <th scope="col" className="num px-3 py-2 font-medium">
              Ratio
            </th>
            <th scope="col" className="num px-3 py-2 font-medium">
              Needs
            </th>
            <th scope="col" className="px-3 py-2 text-left font-medium">
              Result
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const result = resultOf(row)
            return (
              <tr key={row.id} className="border-b border-border last:border-0">
                <th scope="row" className="px-3 py-2 text-left font-medium">
                  {row.label}
                </th>
                <td className="mono px-3 py-2 text-xs text-muted-foreground">{`${row.fg} on ${row.bg}`}</td>
                <td className="num mono px-3 py-2">{formatRatio(row.ratio)}</td>
                <td className="num px-3 py-2">{`${row.need}:1`}</td>
                <td className={`px-3 py-2 ${result.tone}`}>{result.text}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <dt className="w-24 shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="flex flex-wrap items-center gap-4">{children}</dd>
    </div>
  )
}

export default function DesignPage() {
  // Subscribing re-renders the page when the theme changes, so the values read below stay current.
  useTheme()
  const tokens = readThemeTokens()
  const rows = evaluatePairs(tokens)
  const [agent, setAgent] = useState('all')

  return (
    <>
      <PageHeader
        title="Design"
        description="The tokens and components this app is built from. Colours are read from the active theme, so use the toggle in the top bar to compare light and dark."
      />
      <div className="flex flex-col gap-6">
        <Section
          id="design-colours"
          title="Colour tokens"
          note="One blue accent, 1px borders, no gradients. Values are read live from the page."
        >
          <Swatches tokens={tokens} />
        </Section>

        <Section
          id="design-contrast"
          title="Contrast"
          note="Measured from the live colour values with the WCAG formula. Text needs 4.5:1. Icons, dots and field borders need 3:1."
        >
          <ContrastTable rows={rows} />
        </Section>

        <Section
          id="design-type"
          title="Typography"
          note="Inter for the interface. The monospace face is only for IDs, timestamps and latency."
        >
          <ul className="flex flex-col gap-3">
            {TYPE_SCALE.map((item) => (
              <li key={item.cls} className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="mono w-32 shrink-0 text-xs text-muted-foreground">{`${item.cls} / ${item.px}px`}</span>
                <span className={item.cls}>The agent took 2.8 seconds to respond.</span>
                <span className="text-xs text-muted-foreground">{item.use}</span>
              </li>
            ))}
            <li className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="mono w-32 shrink-0 text-xs text-muted-foreground">mono</span>
              <span className="mono text-sm">call-0042 0:18 4,000 ms</span>
              <span className="text-xs text-muted-foreground">IDs, timestamps, latency</span>
            </li>
          </ul>
        </Section>

        <Section id="design-shape" title="Shape and spacing">
          <ul className="grid gap-3 sm:grid-cols-3">
            <li>
              <div className="h-16 rounded-sm border border-border-strong bg-raised" />
              <p className="mono mt-2 text-xs">rounded-sm, 6px</p>
              <p className="text-xs text-muted-foreground">Chips and badges</p>
            </li>
            <li>
              <div className="h-16 rounded-md border border-border-strong bg-raised" />
              <p className="mono mt-2 text-xs">rounded-md, 8px</p>
              <p className="text-xs text-muted-foreground">Controls and buttons</p>
            </li>
            <li>
              <div className="h-16 rounded-xl border border-border-strong bg-raised" />
              <p className="mono mt-2 text-xs">rounded-xl, 12px</p>
              <p className="text-xs text-muted-foreground">Cards</p>
            </li>
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">
            Spacing follows a 4px grid. Borders are 1px. There are no gradients and no heavy shadows.
            Motion is 150 to 200 ms and is switched off for people who ask for reduced motion.
          </p>
        </Section>

        <Section id="design-buttons" title="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Primary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button size="sm" variant="primary">
              Small primary
            </Button>
            <Button size="sm" variant="outline">
              Small outline
            </Button>
            <Button size="sm" variant="ghost">
              Small ghost
            </Button>
            <Button size="sm" variant="outline">
              <span>With icon</span>
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </Section>

        <Section id="design-badges" title="Badges">
          <dl className="flex flex-col gap-3">
            <Row label="Severity">
              <SeverityDot severity="high" />
              <SeverityDot severity="medium" />
              <SeverityDot severity="low" />
              <SeverityDot severity={null} />
            </Row>
            <Row label="Source">
              <SourceBadge source="real" />
              <SourceBadge source="synthetic" />
            </Row>
            <Row label="Review">
              <ReviewBadge status="clean" />
              <ReviewBadge status="unreviewed" />
              <ReviewBadge status="in_review" />
              <ReviewBadge status="reviewed" />
            </Row>
          </dl>
        </Section>

        <Section
          id="design-forms"
          title="Form controls"
          note="Press Tab to see the focus ring: a 2px accent outline with a 2px offset."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Example select" value={agent} onChange={setAgent}>
              <option value="all">All agents</option>
              <option value="hotel-demo">hotel-demo</option>
              <option value="restaurant-demo">restaurant-demo</option>
            </Select>
            <div>
              <label htmlFor="design-field" className="block text-sm font-medium">
                Example field
              </label>
              <input
                id="design-field"
                type="text"
                placeholder="Placeholder text"
                className="mono mt-1 h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              />
            </div>
          </div>
        </Section>

        <Section id="design-metrics" title="Metrics">
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard
              label="Calls analysed"
              value="5"
              detail="5 calls with measurable latency"
              trend={[3, 3, 4, 2]}
            />
            <KpiCard
              label="Avg latency"
              value="743 ms"
              mono
              detail="7 response turns in 5 calls"
              trend={[900, 760, 640, 610]}
            />
            <KpiCard
              label="Failure rate"
              value="0%"
              detail="Calls with a confirmed high-severity finding: 0 of 5"
            />
          </div>
        </Section>

        <Section
          id="design-states"
          title="States"
          note="Every list and chart has a skeleton, an empty state and an error state with Retry. The error sample is inert so it does not announce itself."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <EmptyState
              icon={Inbox}
              message="No calls match these filters."
              action={<Button variant="outline">Clear filters</Button>}
            />
            <div inert>
              <ErrorState message="Cannot reach the server" onRetry={noop} />
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </Section>

        <div className="flex flex-col gap-4">
          <div>
            <h2 id="design-context" className="text-md font-semibold">
              In context
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sample data, not a real call. Nothing here is saved or sent anywhere, and the j and k
              keys only work on the Inspector and Try it pages.
            </p>
          </div>
          <Timeline segments={SEGMENTS} onSelect={noop} />
          <Lanes turns={SAMPLE_TURNS} onSelectTurn={noop} />
          <div className="min-w-0 rounded-xl border border-border bg-card">
            <Transcript turns={SAMPLE_TURNS} highlightedTurn={1} />
          </div>
          <FindingsPanel
            findings={SAMPLE_FINDINGS}
            readOnly={false}
            reviewActions={false}
            sticky={false}
            onGoToTurn={noop}
            onChanged={noop}
          />
        </div>
      </div>
    </>
  )
}
