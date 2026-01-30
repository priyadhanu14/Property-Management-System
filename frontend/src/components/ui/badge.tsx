import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground',
        outline: 'text-foreground',
        vacant: 'border-transparent bg-emerald-600/20 text-emerald-400 border-emerald-500/30',
        reserved: 'border-transparent bg-blue-600/20 text-blue-400 border-blue-500/30',
        occupied: 'border-transparent bg-amber-600/20 text-amber-400 border-amber-500/30',
        cleaning: 'border-transparent bg-slate-600/20 text-slate-400 border-slate-500/30',
        hold: 'border-transparent bg-orange-600/20 text-orange-400 border-orange-500/30',
        cancelled: 'border-transparent bg-muted text-muted-foreground',
        conflict: 'border-transparent bg-red-600/20 text-red-400 border-red-500/30',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
