import { useState } from 'react'
import { Building2, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusChip } from '@/components/rooms/StatusChip'
import { RoomTimeline } from '@/components/rooms/RoomTimeline'
import { MOCK_ROOMS } from '@/data/mockRooms'
import { getBookingsForUnit } from '@/data/mockRooms'
import { cn } from '@/lib/utils'

export function Rooms() {
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null)

  if (selectedUnit) {
    return (
      <div className="space-y-4">
        <RoomTimeline
          unitCode={selectedUnit}
          onBack={() => setSelectedUnit(null)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Rooms & availability</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="size-5" />
            Units
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Tap a unit to see timeline (day/week). Overlapping bookings are stacked; conflicts from import are highlighted.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {MOCK_ROOMS.map((room) => {
              const bookingCount = getBookingsForUnit(room.unit_code).length
              const hasConflict = getBookingsForUnit(room.unit_code).some((b) => b.isConflict)
              return (
                <li key={room.unit_code}>
                  <button
                    type="button"
                    onClick={() => setSelectedUnit(room.unit_code)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 px-6 py-4 text-left transition-colors hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset'
                    )}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="font-medium">{room.unit_code}</span>
                      <span className="text-sm text-muted-foreground">{room.room_type}</span>
                      <StatusChip status={room.status} />
                      {hasConflict && (
                        <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
                          Conflict
                        </span>
                      )}
                      {bookingCount > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {bookingCount} booking{bookingCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
