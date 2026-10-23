import { TriangleAlert } from 'lucide-react'
import Button from '@/components/ui/Button.jsx'
import EmptyState from './EmptyState.jsx'

export default function ErrorState({ message, onRetry }) {
  return (
    <div role="alert">
      <EmptyState
        icon={TriangleAlert}
        message={message || 'Something went wrong.'}
        action={<Button onClick={onRetry}>Retry</Button>}
      />
    </div>
  )
}
