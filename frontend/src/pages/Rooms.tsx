import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Building2, ChevronRight, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusChip } from '@/components/rooms/StatusChip'
import { RoomTimeline } from '@/components/rooms/RoomTimeline'
import { cn } from '@/lib/utils'
import type { Room, RoomStatus } from '@/types/rooms'

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />
}

export function Rooms() {
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)

  const roomsQuery = useQuery({
    queryKey: ['rooms'],
    queryFn: () => api.get<Room[]>('/rooms'),
  })

  const rooms = roomsQuery.data ?? []

  if (selectedRoom) {
    return (
      <div className="space-y-4">
        <RoomTimeline
          roomId={selectedRoom.id}
          unitCode={selectedRoom.unit_code}
          onBack={() => setSelectedRoom(null)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Rooms &amp; availability</h1>

      {roomsQuery.isError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span>Failed to load rooms: {(roomsQuery.error as Error)?.message}</span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="size-5" />
            Units
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Tap a unit to see timeline (day/week).
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {roomsQuery.isLoading && (
            <div className="space-y-1 p-4">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          )}

          {rooms.length === 0 && !roomsQuery.isLoading && (
            <p className="p-6 text-center text-muted-foreground">
              No rooms found. Start the backend to seed the fixed rooms.
            </p>
          )}

          {rooms.length > 0 && (
            <ul className="divide-y divide-border">
              {rooms.map((room) => (
                <li key={room.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedRoom(room)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 px-6 py-4 text-left transition-colors hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset'
                    )}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="font-medium">{room.unit_code}</span>
                      <span className="text-sm text-muted-foreground">{room.room_type}</span>
                      <StatusChip status={room.status as RoomStatus} />
                    </div>
                    <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
