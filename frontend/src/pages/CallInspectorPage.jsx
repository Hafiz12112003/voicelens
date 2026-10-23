import { Search } from 'lucide-react'
import { useParams } from 'react-router-dom'
import EmptyState from '@/components/states/EmptyState.jsx'
import PageHeader from '@/components/PageHeader.jsx'

export default function CallInspectorPage() {
  const { callId } = useParams()
  return (
    <>
      <PageHeader title="Call Inspector" description="Transcript, timeline and findings for one call.">
        <span className="mono text-sm text-muted-foreground">{callId}</span>
      </PageHeader>
      <EmptyState icon={Search} message="The inspector is built in a later step." />
    </>
  )
}
