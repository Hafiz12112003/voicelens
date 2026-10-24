import { Tag } from 'lucide-react'
import { Link } from 'react-router-dom'
import EmptyState from '@/components/states/EmptyState.jsx'
import { formatPercent, ruleLabel } from '@/lib/format.js'
import { plural } from '@/lib/summary.js'

function Ratio({ value }) {
  if (value === null || value === undefined) {
    return (
      <span className="text-muted-foreground">
        <span aria-hidden="true">{'\u2014'}</span>
        <span className="sr-only">Not defined</span>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span aria-hidden="true" className="h-1.5 w-16 overflow-hidden rounded-sm bg-muted">
        <span data-bar className="block h-full bg-primary" style={{ width: `${value * 100}%` }} />
      </span>
      <span className="w-14 text-right tabular-nums">{formatPercent(value)}</span>
    </span>
  )
}

function Head({ children, title }) {
  return (
    <th scope="col" className="num px-3 py-2 font-medium">
      {title ? <abbr title={title}>{children}</abbr> : children}
    </th>
  )
}

export default function AccuracyTable({ accuracy }) {
  if (!accuracy) return null
  const labeled = accuracy.status === 'ok'
  const errors = accuracy.errors || []

  return (
    <section
      aria-labelledby="accuracy-title"
      className="mt-6 rounded-xl border border-border bg-card p-4"
    >
      <h2 id="accuracy-title" className="text-md font-semibold">
        Accuracy
      </h2>
      {accuracy.basis && <p className="mt-1 text-sm text-muted-foreground">{accuracy.basis}</p>}
      {!labeled ? (
        <EmptyState
          icon={Tag}
          message="No labels yet. Accuracy appears once real calls are hand-labeled."
        />
      ) : (
        <>
          <p className="mt-3 text-sm">
            {`${plural(accuracy.n_items, 'labeled item')} across ${plural(accuracy.labeled_calls, 'call')}.`}
          </p>
          <p className="text-sm text-muted-foreground">
            Small sample: treat these numbers as indicative, not as a benchmark.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-base">
              <caption className="sr-only">Precision and recall per rule, from hand labels</caption>
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Rule
                  </th>
                  <Head>Items</Head>
                  <Head title="True positives">TP</Head>
                  <Head title="False positives">FP</Head>
                  <Head title="False negatives">FN</Head>
                  <Head title="True negatives">TN</Head>
                  <Head>Precision</Head>
                  <Head>Recall</Head>
                </tr>
              </thead>
              <tbody>
                {(accuracy.per_rule || []).map((row) => (
                  <tr key={row.rule} className="border-b border-border last:border-0">
                    <th scope="row" className="px-3 py-2 text-left font-medium">
                      {ruleLabel(row.rule)}
                    </th>
                    <td className="num px-3 py-2">{row.items}</td>
                    <td className="num px-3 py-2">{row.tp}</td>
                    <td className="num px-3 py-2">{row.fp}</td>
                    <td className="num px-3 py-2">{row.fn}</td>
                    <td className="num px-3 py-2">{row.tn}</td>
                    <td className="num px-3 py-2">
                      <Ratio value={row.precision} />
                    </td>
                    <td className="num px-3 py-2">
                      <Ratio value={row.recall} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {errors.length > 0 && (
            <>
              <h3 className="mt-4 text-base font-semibold">Where the rules were wrong</h3>
              <ul aria-label="Rule mistakes" className="mt-2 flex flex-col gap-2">
                {errors.map((item) => (
                  <li
                    key={`${item.call_id}-${item.turn_index}-${item.rule}-${item.kind}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
                  >
                    <Link
                      to={`/calls/${encodeURIComponent(item.call_id)}`}
                      className="mono text-primary hover:underline"
                    >
                      {item.call_id}
                    </Link>
                    <span className="num">{`Turn ${item.turn_index}`}</span>
                    <span>{ruleLabel(item.rule)}</span>
                    <span className="text-muted-foreground">{ruleLabel(item.kind)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  )
}
