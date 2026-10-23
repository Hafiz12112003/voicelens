import { Inbox, SearchX } from 'lucide-react'
import { useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import CallCards from '@/components/calls/CallCards.jsx'
import CallsFilters from '@/components/calls/CallsFilters.jsx'
import CallsTable from '@/components/calls/CallsTable.jsx'
import Pagination from '@/components/calls/Pagination.jsx'
import PageHeader from '@/components/PageHeader.jsx'
import EmptyState from '@/components/states/EmptyState.jsx'
import ErrorState from '@/components/states/ErrorState.jsx'
import Button from '@/components/ui/Button.jsx'
import { buttonVariants } from '@/components/ui/buttonVariants.js'
import { useApi } from '@/hooks/useApi.js'
import { hasFilters, nextSort, PAGE_SIZE, readParams, writeParams } from '@/lib/callsQuery.js'
import { cn } from '@/lib/utils.js'
import { listCalls } from '@/services/api.js'

const CLEARED = { q: '', agent: '', source: '', severity: '' }

export default function CallsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const params = readParams(searchParams)
  const key = writeParams(params).toString()

  const { data, error, loading, reload } = useApi(
    () =>
      listCalls({
        q: params.q,
        agent: params.agent,
        source: params.source,
        severity: params.severity,
        sort: params.sort,
        order: params.order,
        page: params.page,
        pageSize: PAGE_SIZE,
      }),
    key,
  )

  const update = useCallback(
    (changes, options) => {
      const next = { ...readParams(searchParams), ...changes }
      if (!('page' in changes)) next.page = 1
      setSearchParams(writeParams(next), options)
    },
    [searchParams, setSearchParams],
  )

  const filtered = hasFilters(params)
  const clear = () => update(CLEARED)
  const onSort = (column) => update(nextSort(params, column))

  let content
  if (error) {
    content = <ErrorState message={error.message} onRetry={reload} />
  } else if (data === null) {
    content = (
      <div aria-busy="true">
        <span className="sr-only">Loading calls</span>
        <CallsTable calls={null} params={params} />
        <CallCards calls={null} />
      </div>
    )
  } else if (data.total === 0) {
    content = filtered ? (
      <EmptyState
        icon={SearchX}
        message="No calls match these filters."
        action={<Button onClick={clear}>Clear filters</Button>}
      />
    ) : (
      <EmptyState
        icon={Inbox}
        message="No calls yet. Import transcripts to get started."
        action={
          <Link to="/summary" className={buttonVariants({ variant: 'primary' })}>
            Import transcripts
          </Link>
        }
      />
    )
  } else if (data.items.length === 0) {
    content = (
      <EmptyState
        icon={SearchX}
        message="That page has no calls."
        action={<Button onClick={() => update({ page: 1 })}>Go to first page</Button>}
      />
    )
  } else {
    content = (
      <div
        aria-busy={loading}
        className={cn('transition-opacity duration-(--dur) ease-(--ease)', loading && 'opacity-60')}
      >
        <CallsTable calls={data.items} params={params} onSort={onSort} />
        <CallCards calls={data.items} />
        <Pagination
          page={data.page}
          totalPages={data.total_pages}
          total={data.total}
          onPage={(page) => update({ page })}
        />
      </div>
    )
  }

  return (
    <>
      <PageHeader title="Calls" description="Imported call transcripts with rule findings." />
      <CallsFilters
        params={params}
        agents={data?.agents ?? []}
        canReset={filtered}
        onChange={update}
        onReset={clear}
      />
      {content}
    </>
  )
}
