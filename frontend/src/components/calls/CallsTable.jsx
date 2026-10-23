import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import ReviewBadge from '@/components/calls/ReviewBadge.jsx'
import SeverityDot from '@/components/calls/SeverityDot.jsx'
import SourceBadge from '@/components/calls/SourceBadge.jsx'
import Skeleton from '@/components/ui/Skeleton.jsx'
import { formatDuration } from '@/lib/format.js'
import { cn } from '@/lib/utils.js'

const COLUMNS = [
  { key: 'call_id', label: 'Call ID', align: 'left' },
  { key: 'agent', label: 'Agent', align: 'left' },
  { key: 'source', label: 'Source', align: 'left' },
  { key: 'duration', label: 'Duration', align: 'right' },
  { key: 'findings', label: 'Findings', align: 'right' },
  { key: 'severity', label: 'Severity', align: 'left' },
]

// Fixed column widths (percent of the table) so the layout never shifts between
// the skeleton, pages and filter results. They add up to 100.
const COLUMN_WIDTHS = [
  'w-[24%]',
  'w-[16%]',
  'w-[11%]',
  'w-[11%]',
  'w-[11%]',
  'w-[12%]',
  'w-[15%]',
]

const HEAD = 'sticky top-0 z-10 h-11 border-b border-border bg-surface px-4 text-xs font-medium'
const CELL = 'border-b border-border px-4'
const SKELETON_ROWS = 8

function HeaderCell({ column, params, onSort, interactive }) {
  const active = params.sort === column.key
  const ascending = params.order === 'asc'
  const Icon = active ? (ascending ? ArrowUp : ArrowDown) : ChevronsUpDown
  const label = (
    <>
      {column.label}
      <Icon aria-hidden="true" className={cn('size-4', active ? 'text-primary' : 'text-faint')} />
    </>
  )
  const shared = 'inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-sm'

  return (
    <th
      scope="col"
      aria-sort={interactive ? (active ? (ascending ? 'ascending' : 'descending') : 'none') : undefined}
      className={cn(HEAD, column.align === 'right' ? 'text-right' : 'text-left')}
    >
      {interactive ? (
        <button
          type="button"
          onClick={() => onSort(column.key)}
          className={cn(
            shared,
            active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {label}
        </button>
      ) : (
        <span className={cn(shared, 'text-muted-foreground')}>{label}</span>
      )}
    </th>
  )
}

function SkeletonRow() {
  return (
    <tr className="h-11">
      <td className={CELL}>
        <Skeleton className="h-4 w-32" />
      </td>
      <td className={CELL}>
        <Skeleton className="h-4 w-24" />
      </td>
      <td className={CELL}>
        <Skeleton className="h-5 w-16" />
      </td>
      <td className={CELL}>
        <Skeleton className="ml-auto h-4 w-10" />
      </td>
      <td className={CELL}>
        <Skeleton className="ml-auto h-4 w-6" />
      </td>
      <td className={CELL}>
        <Skeleton className="h-4 w-16" />
      </td>
      <td className={CELL}>
        <Skeleton className="h-5 w-20" />
      </td>
    </tr>
  )
}

function CallRow({ call }) {
  const navigate = useNavigate()
  const href = `/calls/${encodeURIComponent(call.call_id)}`

  return (
    <tr
      onClick={() => navigate(href)}
      className="h-11 cursor-pointer transition-colors duration-(--dur) ease-(--ease) hover:bg-accent"
    >
      <td className={cn(CELL, 'truncate')}>
        <Link
          to={href}
          title={call.call_id}
          onClick={(event) => event.stopPropagation()}
          className="mono text-sm text-foreground hover:text-primary"
        >
          {call.call_id}
        </Link>
      </td>
      <td className={cn(CELL, 'truncate text-base')} title={call.agent}>
        {call.agent}
      </td>
      <td className={CELL}>
        <SourceBadge source={call.source} />
      </td>
      <td className={cn(CELL, 'num text-base')}>{formatDuration(call.duration_ms)}</td>
      <td className={cn(CELL, 'num text-base', call.findings_count === 0 && 'text-muted-foreground')}>
        {call.findings_count}
      </td>
      <td className={cn(CELL, 'text-sm')}>
        <SeverityDot severity={call.max_severity} />
      </td>
      <td className={CELL}>
        <ReviewBadge status={call.review_status} />
      </td>
    </tr>
  )
}

// calls === null renders the skeleton (same header, same columns, same row height).
// Shown from the lg breakpoint; below it the cards take over (see CallCards).
export default function CallsTable({ calls, params, onSort }) {
  const loading = calls === null

  return (
    <div
      aria-hidden={loading ? 'true' : undefined}
      className="hidden overflow-clip rounded-xl border border-border bg-card lg:block"
    >
      <table className="w-full table-fixed border-separate border-spacing-0 text-base [&_tbody_tr:last-child_td]:border-b-0">
        <caption className="sr-only">Calls</caption>
        <colgroup>
          {COLUMN_WIDTHS.map((width, index) => (
            <col key={index} className={width} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <HeaderCell
                key={column.key}
                column={column}
                params={params}
                onSort={onSort}
                interactive={!loading}
              />
            ))}
            <th scope="col" className={cn(HEAD, 'text-left')}>
              <span className="inline-flex h-8 items-center text-muted-foreground">Review</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: SKELETON_ROWS }, (_, index) => <SkeletonRow key={index} />)
            : calls.map((call) => <CallRow key={call.call_id} call={call} />)}
        </tbody>
      </table>
    </div>
  )
}
