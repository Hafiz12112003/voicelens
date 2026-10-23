import { Gauge } from 'lucide-react'
import EmptyState from '@/components/states/EmptyState.jsx'
import PageHeader from '@/components/PageHeader.jsx'

export default function SummaryPage() {
  return (
    <>
      <PageHeader title="Summary" description="Metrics, findings per rule and the accuracy report." />
      <EmptyState icon={Gauge} message="The summary dashboard is built in a later step." />
    </>
  )
}
