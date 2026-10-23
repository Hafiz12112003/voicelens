import { Phone } from 'lucide-react'
import EmptyState from '@/components/states/EmptyState.jsx'
import PageHeader from '@/components/PageHeader.jsx'

export default function CallsPage() {
  return (
    <>
      <PageHeader title="Calls" description="Imported call transcripts with rule findings." />
      <EmptyState icon={Phone} message="The calls table is built in the next step." />
    </>
  )
}
