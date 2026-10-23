import { Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import Button from '@/components/ui/Button.jsx'
import Select from '@/components/ui/Select.jsx'

const DEBOUNCE_MS = 300

// Stacked (search on its own row, dropdowns below) until xl; one row from xl up.
export default function CallsFilters({ params, agents, canReset, onChange, onReset }) {
  const [text, setText] = useState(params.q)
  const [syncedQ, setSyncedQ] = useState(params.q)
  const inputRef = useRef(null)

  // Keep the search box in step with the URL (back button, Clear filters).
  if (params.q !== syncedQ) {
    setSyncedQ(params.q)
    setText(params.q)
  }

  // Write the search text to the URL once typing pauses.
  useEffect(() => {
    const wanted = text.trim()
    if (wanted === params.q) return undefined
    const id = setTimeout(() => onChange({ q: wanted }, { replace: true }), DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [text, params.q, onChange])

  const clearSearch = () => {
    setText('')
    onChange({ q: '' }, { replace: true })
    inputRef.current?.focus()
  }

  return (
    <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center">
      <div className="relative min-w-0 xl:max-w-sm xl:flex-1">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          ref={inputRef}
          type="search"
          aria-label="Search calls"
          placeholder="Search call ID or transcript text"
          spellCheck={false}
          autoComplete="off"
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="h-10 w-full rounded-md border border-input bg-card pl-10 pr-10 text-base text-foreground placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
        />
        {text && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={clearSearch}
            className="absolute right-1 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors duration-(--dur) ease-(--ease) hover:bg-accent hover:text-foreground"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-3 xl:flex">
        <Select
          label="Agent"
          value={params.agent}
          onChange={(agent) => onChange({ agent })}
          className="xl:w-40"
        >
          <option value="">All agents</option>
          {agents.map((agent) => (
            <option key={agent} value={agent}>
              {agent}
            </option>
          ))}
        </Select>
        <Select
          label="Source"
          value={params.source}
          onChange={(source) => onChange({ source })}
          className="xl:w-40"
        >
          <option value="">All sources</option>
          <option value="real">Real</option>
          <option value="synthetic">Synthetic</option>
        </Select>
        <Select
          label="Severity"
          value={params.severity}
          onChange={(severity) => onChange({ severity })}
          className="xl:w-40"
        >
          <option value="">All severities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </Select>
      </div>
      {canReset && (
        <Button variant="ghost" aria-label="Reset filters" onClick={onReset}>
          <X aria-hidden="true" className="size-4" />
          Reset
        </Button>
      )}
    </div>
  )
}
