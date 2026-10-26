import Button from '@/components/ui/Button.jsx'
import Skeleton from '@/components/ui/Skeleton.jsx'
import { formatSettingValue } from '@/lib/workbench.js'

// Arrow keys in a number field step by this much (typing any value still works).
function stepFor(field) {
  if (field.unit === 'ms') return 100
  return field.type === 'integer' ? 1 : 0.05
}

export default function SettingsPanel({
  fields,
  values,
  changed,
  loading,
  error,
  onChange,
  onReset,
  onRetry,
}) {
  return (
    <section
      aria-labelledby="wb-settings-title"
      className="min-w-0 rounded-xl border border-border bg-card p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="wb-settings-title" className="text-md font-semibold">
          Settings
        </h2>
        <Button size="sm" variant="ghost" disabled={!changed} onClick={onReset}>
          Reset to defaults
        </Button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Change a threshold to run the rules again on the same call. A blank field uses the default.
        These settings apply to this page only.
      </p>

      {loading && (
        <div aria-busy="true" aria-label="Loading settings" className="mt-3">
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {!loading && error && (
        <div role="status" className="mt-3 text-sm">
          <p>{`Settings are unavailable: ${error.message}`}</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={onRetry}>
            Retry loading settings
          </Button>
        </div>
      )}

      {!loading && !error && (
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.key} className="min-w-0">
              <label htmlFor={`wb-set-${field.key}`} className="block text-sm font-medium">
                {`${field.ruleName}: ${field.label}`}
              </label>
              <input
                id={`wb-set-${field.key}`}
                type="number"
                inputMode={field.type === 'integer' ? 'numeric' : 'decimal'}
                min={field.min}
                max={field.max}
                step={stepFor(field)}
                value={values[field.key] ?? ''}
                placeholder={String(field.default)}
                onChange={(event) => onChange(field.key, event.target.value)}
                className="mono mt-1 h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {`Default ${formatSettingValue(field.default, field.unit)}, range ${formatSettingValue(field.min, field.unit)} to ${formatSettingValue(field.max, field.unit)}`}
              </p>
              <p className="mono text-xs text-muted-foreground">{field.key}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
