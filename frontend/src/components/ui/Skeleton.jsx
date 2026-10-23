import { cn } from '@/lib/utils.js'

export default function Skeleton({ className }) {
  return <div aria-hidden="true" className={cn('rounded-md bg-raised', className)} />
}
