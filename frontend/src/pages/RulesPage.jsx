import { useApi } from '@/hooks/useApi.js'
import PageHeader from '@/components/PageHeader.jsx'
import ErrorState from '@/components/states/ErrorState.jsx'
import Skeleton from '@/components/ui/Skeleton.jsx'
import { cn } from '@/lib/utils.js'
import { getRules } from '@/services/api.js'

function formatValue(value, unit) {
  if (typeof value !== 'number') return String(value)
  if (unit === 'ms') return `${value.toLocaleString('en-US')} ms`
  return String(value)
}

function ValidationBadge({ validated }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center rounded-sm border px-2 text-xs',
        validated
          ? 'border-success text-success'
          : 'border-dashed border-border-strong text-muted-foreground',
      )}
    >
      {validated ? 'Validated' : 'Not validated'}
    </span>
  )
}

function Fact({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-base">{children}</dd>
    </div>
  )
}

function SettingsTable({ rule }) {
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full min-w-[420px] text-base">
        <caption className="sr-only">{`Settings for ${rule.name}`}</caption>
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th scope="col" className="px-3 py-2 text-left font-medium">
              Setting
            </th>
            <th scope="col" className="px-3 py-2 text-left font-medium">
              Default
            </th>
            <th scope="col" className="px-3 py-2 text-left font-medium">
              Allowed range
            </th>
          </tr>
        </thead>
        <tbody>
          {rule.thresholds.map((t) => (
            <tr key={t.key} className="border-b border-border last:border-0">
              <th scope="row" className="px-3 py-2 text-left font-medium">
                <span>{t.label}</span>
                <span className="mono block text-xs font-normal text-muted-foreground">{t.key}</span>
              </th>
              <td className="px-3 py-2">{formatValue(t.default, t.unit)}</td>
              <td className="px-3 py-2">{`${formatValue(t.min, t.unit)} to ${formatValue(t.max, t.unit)}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RuleCard({ rule }) {
  const titleId = `rule-${rule.id}`
  const needs = rule.needs || []
  const thresholds = rule.thresholds || []
  const limits = rule.known_limits || []
  return (
    <section aria-labelledby={titleId} className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id={titleId} className="text-md font-semibold">
            {rule.name}
          </h2>
          <p className="mono mt-1 text-xs text-muted-foreground">{rule.id}</p>
        </div>
        <ValidationBadge validated={rule.validated} />
      </div>
      <p className="mt-3 text-base">{rule.description}</p>
      <dl className="mt-4 grid gap-4 sm:grid-cols-3">
        <Fact label="Severity">{rule.severity}</Fact>
        <Fact label="Applies to">{rule.applies_to}</Fact>
        <Fact label="Needs">{needs.length > 0 ? needs.join('; ') : 'Nothing beyond the transcript'}</Fact>
      </dl>
      <h3 className="mt-4 text-base font-semibold">Settings</h3>
      {thresholds.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">No settings.</p>
      ) : (
        <SettingsTable rule={{ ...rule, thresholds }} />
      )}
      <h3 className="mt-4 text-base font-semibold">Known limits</h3>
      <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
        {limits.map((limit) => (
          <li key={limit} className="break-words">
            {limit}
          </li>
        ))}
      </ul>
    </section>
  )
}

function RulesSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading rules" className="flex flex-col gap-4">
      {[0, 1, 2].map((key) => (
        <Skeleton key={key} className="h-48 w-full rounded-xl" />
      ))}
    </div>
  )
}

export default function RulesPage() {
  const { data, error, reload } = useApi(getRules, 'rules')
  const header = (
    <PageHeader
      title="Rules"
      description="Every rule is a fixed, deterministic check. None has been validated on real calls, and each one lists what it cannot do."
    />
  )

  if (error && !data) {
    return (
      <>
        {header}
        <ErrorState message={error.message} onRetry={reload} />
      </>
    )
  }

  if (!data) {
    return (
      <>
        {header}
        <RulesSkeleton />
      </>
    )
  }

  const names = (data.languages || []).map((language) => language.name).join(', ') || 'none'
  return (
    <>
      {header}
      <p className="mb-4 text-sm text-muted-foreground">
        {`Phrase lists: ${names}. The rules that match specific words do not work in other languages.`}
      </p>
      <div className="flex flex-col gap-4">
        {(data.rules || []).map((rule) => (
          <RuleCard key={rule.id} rule={rule} />
        ))}
      </div>
    </>
  )
}
