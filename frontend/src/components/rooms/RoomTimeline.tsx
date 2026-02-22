import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, AlertCircle } from 'lucide-react'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { BookingBlock } from '@/components/rooms/BookingBlock'
import { BookingDetailSheet } from '@/components/rooms/BookingDetailSheet'
import { assignLanes, bookingInRange, startOfDay, endOfDay, weekDays } from '@/lib/timeline'
import type { BookingBlock as BookingBlockType, BookingResponse, TimelineView } from '@/types/rooms'

interface RoomTimelineProps {
  roomId: number
  unitCode: string
  onBack: () => void
}

interface TimelineAPIResponse {
  room_id: number
  unit_code: string
  bookings: BookingResponse[]
}

const LANE_HEIGHT = 40
const HOURS_PER_DAY = 24

function formatDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function apiBookingToBlock(b: BookingResponse, unitCode: string): BookingBlockType {
  return {
    id: b.id,
    unit_code: unitCode,
    guest_name: b.guest_name,
    event_type: b.event_type,
    start: b.start_datetime,
    end: b.end_datetime,
    status: b.status as BookingBlockType['status'],
  }
}

function getRangeForView(view: TimelineView, baseDate: Date): { start: string; end: string } {
  if (view === 'day') {
    return { start: startOfDay(baseDate), end: endOfDay(baseDate) }
  }
  const days = weekDays(baseDate)
  return { start: startOfDay(days[0]), end: endOfDay(days[6]) }
}

function dayScaleStart(view: TimelineView, baseDate: Date): number {
  if (view === 'day') return new Date(startOfDay(baseDate)).getTime()
  const days = weekDays(baseDate)
  return new Date(startOfDay(days[0])).getTime()
}

function dayScaleEnd(view: TimelineView, baseDate: Date): number {
  if (view === 'day') return new Date(endOfDay(baseDate)).getTime()
  const days = weekDays(baseDate)
  return new Date(endOfDay(days[6])).getTime()
}

export function RoomTimeline({ roomId, unitCode, onBack }: RoomTimelineProps) {
  const queryClient = useQueryClient()
  const [view, setView] = useState<TimelineView>('week')
  const [baseDate, setBaseDate] = useState(() => new Date())
  const [selectedBooking, setSelectedBooking] = useState<BookingBlockType | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const { start: rangeStart, end: rangeEnd } = getRangeForView(view, baseDate)
  const scaleStart = dayScaleStart(view, baseDate)
  const scaleEnd = dayScaleEnd(view, baseDate)
  const scaleDuration = scaleEnd - scaleStart

  const fromDate = toISODate(new Date(rangeStart))
  const toDate = toISODate(new Date(rangeEnd))

  const timelineQuery = useQuery({
    queryKey: ['room-timeline', roomId, fromDate, toDate],
    queryFn: () =>
      api.get<TimelineAPIResponse>(
        `/rooms/${roomId}/timeline?from_date=${fromDate}&to_date=${toDate}`
      ),
  })

  const bookingsInRange = useMemo(() => {
    if (!timelineQuery.data) return []
    return timelineQuery.data.bookings
      .map((b) => apiBookingToBlock(b, unitCode))
      .filter((b) => bookingInRange(b.start, b.end, rangeStart, rangeEnd))
  }, [timelineQuery.data, unitCode, rangeStart, rangeEnd])

  const withLanes = useMemo(() => assignLanes(bookingsInRange), [bookingsInRange])

  const openDetail = (b: BookingBlockType) => {
    setSelectedBooking(b)
    setSheetOpen(true)
  }

  const handleActionDone = () => {
    setSheetOpen(false)
    setSelectedBooking(null)
    queryClient.invalidateQueries({ queryKey: ['room-timeline', roomId] })
  }

  const dayLabels = view === 'week' ? weekDays(baseDate) : [baseDate]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to list">
          <ChevronLeft className="size-5" />
        </Button>
        <h2 className="font-semibold">Unit {unitCode}</h2>
      </div>

      <div className="flex gap-2">
        <Button variant={view === 'day' ? 'default' : 'outline'} size="sm" onClick={() => setView('day')}>
          Day
        </Button>
        <Button variant={view === 'week' ? 'default' : 'outline'} size="sm" onClick={() => setView('week')}>
          Week
        </Button>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const d = new Date(baseDate)
            d.setDate(d.getDate() - (view === 'day' ? 1 : 7))
            setBaseDate(d)
          }}
        >
          Prev
        </Button>
        <span>
          {view === 'day'
            ? formatDate(baseDate)
            : `${formatDate(weekDays(baseDate)[0])} – ${formatDate(weekDays(baseDate)[6])}`}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const d = new Date(baseDate)
            d.setDate(d.getDate() + (view === 'day' ? 1 : 7))
            setBaseDate(d)
          }}
        >
          Next
        </Button>
      </div>

      {timelineQuery.isError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span>Failed to load timeline</span>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <div className="min-w-[320px] p-2">
          <div className="flex border-b pb-1 mb-2">
            {view === 'day' ? (
              <>
                {Array.from({ length: HOURS_PER_DAY }, (_, i) => (
                  <div
                    key={i}
                    className="flex-shrink-0 text-[10px] text-muted-foreground"
                    style={{ width: `${100 / HOURS_PER_DAY}%` }}
                  >
                    {i}:00
                  </div>
                ))}
              </>
            ) : (
              dayLabels.map((d) => (
                <div
                  key={d.toISOString()}
                  className="flex-shrink-0 text-[10px] text-muted-foreground text-center"
                  style={{ width: `${100 / 7}%` }}
                >
                  {`${d.toLocaleDateString('en-US', { weekday: 'short' })} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`}
                </div>
              ))
            )}
          </div>

          {timelineQuery.isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}

          {!timelineQuery.isLoading && withLanes.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">No bookings in range</p>
          )}

          {withLanes.length > 0 && (
            <div className="relative">
              {Array.from(
                { length: Math.max(...withLanes.map((b) => b.lane)) + 1 },
                (_, laneIndex) => (
                  <div
                    key={laneIndex}
                    className="relative border-b border-border/50 last:border-0"
                    style={{ height: LANE_HEIGHT }}
                  >
                    {withLanes
                      .filter((b) => b.lane === laneIndex)
                      .map((b) => {
                        const bStart = new Date(b.start).getTime()
                        const bEnd = new Date(b.end).getTime()
                        const left = (bStart - scaleStart) / scaleDuration
                        const width = (bEnd - bStart) / scaleDuration
                        return (
                          <BookingBlock
                            key={b.id}
                            booking={b}
                            left={Math.max(0, left)}
                            width={Math.min(1 - left, width)}
                            onClick={() => openDetail(b)}
                          />
                        )
                      })}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>

      <BookingDetailSheet
        booking={selectedBooking}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onActionDone={handleActionDone}
      />
    </div>
  )
}
