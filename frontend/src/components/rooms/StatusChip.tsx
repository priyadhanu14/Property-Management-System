import { Badge } from '@/components/ui/badge'
import type { RoomStatus } from '@/types/rooms'

const STATUS_VARIANT: Record<RoomStatus, 'vacant' | 'reserved' | 'occupied' | 'cleaning' | 'hold' | 'cancelled'> = {
  Vacant: 'vacant',
  Reserved: 'reserved',
  Occupied: 'occupied',
  Cleaning: 'cleaning',
  Hold: 'hold',
  Cancelled: 'cancelled',
}

interface StatusChipProps {
  status: RoomStatus
  className?: string
}

export function StatusChip({ status, className }: StatusChipProps) {
  return (
    <Badge
      variant={STATUS_VARIANT[status]}
      className={className}
    >
      {status}
    </Badge>
  )
}
