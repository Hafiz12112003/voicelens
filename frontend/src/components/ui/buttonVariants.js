import { cva } from 'class-variance-authority'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-base font-medium whitespace-nowrap transition-[color,background-color,border-color,opacity] duration-(--dur) ease-(--ease) disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:opacity-90',
        outline: 'border border-input bg-transparent text-foreground hover:bg-accent',
        ghost: 'text-muted-foreground hover:bg-accent hover:text-foreground',
      },
      size: {
        md: 'h-10 px-4',
        sm: 'h-8 px-3 text-sm',
      },
    },
    defaultVariants: { variant: 'outline', size: 'md' },
  },
)
