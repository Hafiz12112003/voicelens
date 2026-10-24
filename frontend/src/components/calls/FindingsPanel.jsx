import { useState } from 'react'
import { ArrowRight, CircleCheck } from 'lucide-react'
import SeverityDot from '@/components/calls/SeverityDot.jsx'
import EmptyState from '@/components/states/EmptyState.jsx'
import Button from '@/components/ui/Button.jsx'
import { orderFindings } from '@/lib/inspector.js'
import { cn } from '@/lib/utils.js'
import { updateFinding } from '@/services/api.js'

const STATUS_LABELS = { open: 'Open', confirmed: 'Confirmed', dismissed: 'Dismissed' }
const STATUS_STYLES = {
  open: 'text-foreground',
  confirmed: 'text-success',
  dismissed: 'text-muted-foreground',
}

function ruleLabel(rule) {
  const text = String(rule || '').replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function evidenceText(evidence) {
  if (evidence === null || evidence === undefined) return ''
  return typeof evidence === 'string' ? evidence : JSON.stringify(evidence)
}

function FindingCard({ finding, active, readOnly, onGoToTurn, onSelect, onChanged }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const disabled = readOnly || saving
  const hasTurn = finding.turn_index !== null && finding.turn_index !== undefined
  const evidence = evidenceText(finding.evidence)

  async function save(patch) {
    setSaving(true)
    setError(null)
    try {
      await updateFinding(finding.id, patch)
      onChanged()
      return true
    } catch (err) {
      setError(err.message || 'Try again.')
      return false
    } finally {
      setSaving(false)
    }
  }

  function toggle(target) {
    save({ status: finding.status === target ? 'open' : target })
  }

  function openNote() {
    setDraft(finding.note || '')
    setError(null)
    setEditing(true)
  }

  async function saveNote() {
    const ok = await save({ note: draft.trim() })
    if (ok) setEditing(false)
  }

  function goToTurn() {
    if (onSelect) onSelect(finding.id)
    onGoToTurn(finding.turn_index)
  }

  return (
    <li
      data-finding-id={finding.id}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'rounded-md border bg-background p-3 transition-colors duration-(--dur) ease-(--ease)',
        active ? 'border-primary' : 'border-border',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <SeverityDot severity={finding.severity} />
          <span className="font-medium">{ruleLabel(finding.rule)}</span>
        </div>
        <span
          className={cn(
            'inline-flex h-5 shrink-0 items-center rounded-sm border border-border px-2 text-xs',
            STATUS_STYLES[finding.status],
          )}
        >
          {STATUS_LABELS[finding.status] ?? finding.status}
        </span>
      </div>

      <p className="mt-2 break-words text-base">{finding.explanation}</p>
      {evidence && (
        <blockquote className="mt-2 break-words border-l-2 border-border-strong pl-3 text-sm text-muted-foreground">
          {evidence}
        </blockquote>
      )}

      {hasTurn ? (
        <Button size="sm" variant="ghost" className="mt-2 -ml-3" onClick={goToTurn}>
          <span>{`Go to turn ${finding.turn_index}`}</span>
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Not tied to one turn.</p>
      )}

      {finding.note && !editing && (
        <p className="mt-2 whitespace-pre-wrap break-words text-sm">
          <span className="text-muted-foreground">Note: </span>
          {finding.note}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={finding.status === 'confirmed' ? 'primary' : 'outline'}
          aria-pressed={finding.status === 'confirmed'}
          disabled={disabled}
          onClick={() => toggle('confirmed')}
        >
          Confirm
        </Button>
        <Button
          size="sm"
          variant={finding.status === 'dismissed' ? 'primary' : 'outline'}
          aria-pressed={finding.status === 'dismissed'}
          disabled={disabled}
          onClick={() => toggle('dismissed')}
        >
          Dismiss
        </Button>
        <Button size="sm" variant="ghost" disabled={disabled} aria-expanded={editing} onClick={openNote}>
          {finding.note ? 'Edit note' : 'Note'}
        </Button>
      </div>

      {editing && (
        <div className="mt-3">
          <label htmlFor={`note-${finding.id}`} className="sr-only">
            Note for this finding
          </label>
          <textarea
            id={`note-${finding.id}`}
            rows={3}
            value={draft}
            disabled={saving}
            onChange={(event) => setDraft(event.target.value)}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-base"
          />
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="primary" disabled={disabled} onClick={saveNote}>
              Save note
            </Button>
            <Button size="sm" variant="ghost" disabled={saving} onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-foreground">
          Could not save: {error}
        </p>
      )}
    </li>
  )
}

export default function FindingsPanel({
  findings,
  activeId = null,
  readOnly,
  className,
  onGoToTurn,
  onSelect,
  onChanged,
}) {
  const ordered = orderFindings(findings)
  return (
    <section
      aria-label="Findings"
      data-view="findings"
      className={cn(
        'rounded-xl border border-border bg-card max-xl:order-first xl:sticky xl:top-4 xl:max-h-[calc(100dvh-6rem)] xl:self-start xl:overflow-y-auto',
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="text-md font-semibold">
          Findings <span className="num text-muted-foreground">{ordered.length}</span>
        </h2>
        {ordered.length > 0 && (
          <p className="hidden text-xs text-muted-foreground xl:block">
            <span className="mono">j</span> / <span className="mono">k</span> step,{' '}
            <span className="mono">Esc</span> clear
          </p>
        )}
      </div>
      {readOnly && (
        <p role="status" className="border-b border-border px-4 py-3 text-sm text-muted-foreground">
          Review actions are unavailable while you view a saved snapshot.
        </p>
      )}
      {ordered.length === 0 ? (
        <EmptyState icon={CircleCheck} message="No findings on this call." />
      ) : (
        <ul className="flex flex-col gap-3 p-3">
          {ordered.map((finding) => (
            <FindingCard
              key={finding.id}
              finding={finding}
              active={finding.id === activeId}
              readOnly={readOnly}
              onGoToTurn={onGoToTurn}
              onSelect={onSelect}
              onChanged={onChanged}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
