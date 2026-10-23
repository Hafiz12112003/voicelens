import { Compass } from 'lucide-react'
import { Link } from 'react-router-dom'
import EmptyState from '@/components/states/EmptyState.jsx'

export default function NotFoundPage() {
  return (
    <EmptyState
      icon={Compass}
      message="That page does not exist."
      action={
        <Link
          to="/calls"
          className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-base font-medium text-primary-foreground transition-opacity duration-(--dur) ease-(--ease) hover:opacity-90"
        >
          Go to calls
        </Link>
      }
    />
  )
}
