import { useRef, useState } from 'react'
import { FileUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import Button from '@/components/ui/Button.jsx'
import { useSnapshotMode } from '@/hooks/useSnapshotMode.js'
import { plural } from '@/lib/summary.js'
import { cn } from '@/lib/utils.js'
import { importTranscripts } from '@/services/api.js'

const ACCEPTED_EXTENSIONS = ['.json', '.csv']
// The API returns at most this many problems, even when there are more.
const DETAILS_LIMIT = 50

function hasAcceptedExtension(name) {
  const lower = String(name || '').toLowerCase()
  return ACCEPTED_EXTENSIONS.some((extension) => lower.endsWith(extension))
}

export default function ImportCard({ onImported }) {
  const readOnly = useSnapshotMode()
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [problem, setProblem] = useState(null)
  const disabled = readOnly || busy

  async function upload(file) {
    setResult(null)
    setProblem(null)
    if (!hasAcceptedExtension(file.name)) {
      setProblem({ message: 'Choose a .json or .csv file.', details: [] })
      return
    }
    setBusy(true)
    try {
      const outcome = await importTranscripts(file)
      const imported = (outcome.imported || []).length
      setResult({ imported, skipped: outcome.skipped || [], findings: outcome.findings || 0 })
      if (imported > 0 && onImported) onImported()
    } catch (error) {
      setProblem({ message: error.message || 'Import failed.', details: error.details || [] })
    } finally {
      setBusy(false)
    }
  }

  function handleChange(event) {
    const file = event.target.files?.[0]
    // Reset so the same file can be chosen again after fixing it.
    event.target.value = ''
    if (file) upload(file)
  }

  function handleDrop(event) {
    event.preventDefault()
    setDragging(false)
    if (disabled) return
    const files = event.dataTransfer?.files
    if (!files || files.length === 0) return
    if (files.length > 1) {
      setResult(null)
      setProblem({ message: 'Drop one file at a time.', details: [] })
      return
    }
    upload(files[0])
  }

  return (
    <section
      aria-labelledby="import-title"
      className="mt-6 rounded-xl border border-border bg-card p-4"
    >
      <h2 id="import-title" className="text-md font-semibold">
        Import calls
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Upload transcripts as .json or .csv. Duplicate call IDs are skipped, and if any call is
        invalid nothing is imported.
      </p>

      <div
        data-testid="dropzone"
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false)
        }}
        onDrop={handleDrop}
        className={cn(
          'mt-3 flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-8 text-center transition-colors duration-(--dur) ease-(--ease)',
          dragging ? 'border-primary bg-accent' : 'border-border-strong',
        )}
      >
        <FileUp className="size-5 text-muted-foreground" aria-hidden="true" />
        <p className="text-base">Drop a file here, or</p>
        <Button disabled={disabled} onClick={() => inputRef.current?.click()}>
          {busy ? 'Importing...' : 'Choose file'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".json,.csv"
          aria-label="Transcript file"
          tabIndex={-1}
          className="hidden"
          onChange={handleChange}
        />
      </div>

      {readOnly && (
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          Importing is unavailable while you view a saved snapshot.
        </p>
      )}

      {result && (
        <div role="status" className="mt-3 flex flex-col gap-1 text-sm">
          {result.imported > 0 ? (
            <p>{`Imported ${plural(result.imported, 'call')} and ${plural(result.findings, 'finding')}.`}</p>
          ) : (
            <p>{`No new calls imported: ${plural(result.skipped.length, 'call')} already existed.`}</p>
          )}
          {result.imported > 0 && result.skipped.length > 0 && (
            <p className="break-words text-muted-foreground">
              {`Skipped ${plural(result.skipped.length, 'duplicate')}: ${result.skipped.join(', ')}`}
            </p>
          )}
          {result.imported > 0 && (
            <Link to="/calls" className="self-start text-primary hover:underline">
              View calls
            </Link>
          )}
        </div>
      )}

      {problem && (
        <div role="alert" className="mt-3 text-sm">
          <p className="font-medium">{problem.message}</p>
          {problem.details.length > 0 && (
            <>
              <ul
                aria-label="Validation problems"
                className="mt-2 flex list-disc flex-col gap-1 pl-5 text-muted-foreground"
              >
                {problem.details.map((detail, index) => (
                  <li key={`${index}-${detail}`} className="break-words">
                    {detail}
                  </li>
                ))}
              </ul>
              {problem.details.length >= DETAILS_LIMIT && (
                <p className="mt-2 text-muted-foreground">
                  {`Showing the first ${DETAILS_LIMIT} problems. Fix these and import again to see the rest.`}
                </p>
              )}
            </>
          )}
        </div>
      )}

      <p className="mt-4 text-sm text-muted-foreground">
        {'Mark a call '}
        <span className="mono">&quot;source&quot;: &quot;real&quot;</span>
        {
          ' only if you recorded it yourself from a real agent. Synthetic calls stay out of the accuracy numbers.'
        }
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {'Not sure about the format? '}
        <a
          href="/sample-calls.json"
          download="voicelens-sample-calls.json"
          className="text-primary hover:underline"
        >
          Download a sample file
        </a>
        {' (marked synthetic).'}
      </p>
    </section>
  )
}
