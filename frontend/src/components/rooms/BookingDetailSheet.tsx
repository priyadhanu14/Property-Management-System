import * as React from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { BookingBlock } from '@/types/rooms'

interface BookingDetailSheetProps {
  booking: BookingBlock | null
  onClose: () => void
  open: boolean
}

function formatRange(start: string, end: string): string {
  const d1 = new Date(start)
  const d2 = new Date(end)
  return `${d1.toLocaleDateString()} ${d1.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${d2.toLocaleDateString()} ${d2.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

export function BookingDetailSheet({ booking, onClose, open }: BookingDetailSheetProps) {
  if (!booking) return null

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 transition-opacity',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden
      />
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50 rounded-t-xl border bg-card shadow-lg transition-transform duration-200 ease-out',
          open ? 'translate-y-0' : 'translate-y-full'
        )}
      >
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="font-semibold">Booking details</h3>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>
        <div className="max-h-[70vh] overflow-auto p-4 space-y-3">
          {booking.isConflict && (
            <p className="text-sm text-red-400 bg-red-500/10 rounded-md p-2">
              Conflict — overlapping booking (e.g. from import). Resolve in import or adjust dates.
            </p>
          )}
          <p><span className="text-muted-foreground">Unit</span> {booking.unit_code}</p>
          <p><span className="text-muted-foreground">Guest</span> {booking.guest_name}</p>
          {booking.event_type && (
            <p><span className="text-muted-foreground">Event</span> {booking.event_type}</p>
          )}
          <p><span className="text-muted-foreground">Time</span> {formatRange(booking.start, booking.end)}</p>
          <p><span className="text-muted-foreground">Status</span> {booking.status}</p>
        </div>
        <div className="flex flex-wrap gap-2 p-4 border-t">
          <Button size="sm" variant="outline">Check-in</Button>
          <Button size="sm" variant="outline">Check-out</Button>
          <Button size="sm" variant="outline">Edit</Button>
          <Button size="sm" variant="destructive">Cancel booking</Button>
        </div>
      </div>
    </>
  )
}
