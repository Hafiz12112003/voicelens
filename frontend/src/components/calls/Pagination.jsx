import { ChevronLeft, ChevronRight } from 'lucide-react'
import Button from '@/components/ui/Button.jsx'

export default function Pagination({ page, totalPages, total, onPage }) {
  return (
    <div className="mt-4 flex items-center justify-between gap-4">
      <p className="text-sm tabular-nums text-muted-foreground">
        {`Page ${page} of ${totalPages} \u00b7 ${total} ${total === 1 ? 'call' : 'calls'}`}
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          Previous
        </Button>
        <Button
          size="sm"
          aria-label="Next page"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Next
          <ChevronRight aria-hidden="true" className="size-4" />
        </Button>
      </div>
    </div>
  )
}
