import { cn } from '@/lib/utils'
import type { BookingBlock as BookingBlockType } from '@/types/rooms'

interface BookingBlockProps {
  booking: BookingBlockType & { lane?: number }
  /** 0–1 position of start in the day/week scale */
  left: number
  /** 0–1 width on the scale */
  width: number
  onClick: () => void
  className?: string
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function BookingBlock({ booking, left, width, onClick, className }: BookingBlockProps) {
  const isConflict = booking.isConflict === true
  const isOccupied = booking.status === 'occupied'

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'absolute top-0 min-h-[32px] rounded px-2 py-1 text-left text-xs font-medium transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring',
        isConflict && 'border-2 border-red-500 bg-red-500/20 text-red-200',
        !isConflict && isOccupied && 'bg-amber-600/30 text-amber-100 border border-amber-500/50',
        !isConflict && !isOccupied && 'bg-blue-600/30 text-blue-100 border border-blue-500/50',
        className
      )}
      style={{
        left: `${left * 100}%`,
        width: `${Math.max(width * 100, 8)}%`,
      }}
    >
      <span className="block truncate">{booking.guest_name}</span>
      <span className="block truncate text-[10px] opacity-90">
        {formatTime(booking.start)} – {formatTime(booking.end)}
      </span>
      {isConflict && <span className="block text-[10px] text-red-300">Conflict</span>}
    </button>
  )
}
