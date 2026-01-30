import { useMemo, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BookingBlock } from '@/components/rooms/BookingBlock'
import { BookingDetailSheet } from '@/components/rooms/BookingDetailSheet'
import { getBookingsForUnit } from '@/data/mockRooms'
import { assignLanes, bookingInRange, startOfDay, endOfDay, weekDays } from '@/lib/timeline'
import type { BookingBlock as BookingBlockType, TimelineView } from '@/types/rooms'

interface RoomTimelineProps {
  unitCode: string
  onBack: () => void
}

const LANE_HEIGHT = 40
const HOURS_PER_DAY = 24

function getRangeForView(view: TimelineView, baseDate: Date): { start: string; end: string } {
  if (view === 'day') {
    return {
      start: startOfDay(baseDate),
      end: endOfDay(baseDate),
    }
  }
  const days = weekDays(baseDate)
  return {
    start: startOfDay(days[0]),
    end: endOfDay(days[6]),
  }
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

export function RoomTimeline({ unitCode, onBack }: RoomTimelineProps) {
  const [view, setView] = useState<TimelineView>('day')
  const [baseDate, setBaseDate] = useState(() => new Date())
  const [selectedBooking, setSelectedBooking] = useState<BookingBlockType | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const { start: rangeStart, end: rangeEnd } = getRangeForView(view, baseDate)
  const scaleStart = dayScaleStart(view, baseDate)
  const scaleEnd = dayScaleEnd(view, baseDate)
  const scaleDuration = scaleEnd - scaleStart

  const bookingsInRange = useMemo(() => {
    const all = getBookingsForUnit(unitCode)
    return all.filter((b) => bookingInRange(b.start, b.end, rangeStart, rangeEnd))
  }, [unitCode, rangeStart, rangeEnd])

  const withLanes = useMemo(() => assignLanes(bookingsInRange), [bookingsInRange])

  const openDetail = (b: BookingBlockType) => {
    setSelectedBooking(b)
    setSheetOpen(true)
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
        <Button
          variant={view === 'day' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setView('day')}
        >
          Day
        </Button>
        <Button
          variant={view === 'week' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setView('week')}
        >
          Week
        </Button>
      </div>

      {/* Date nav (simple: today / prev / next) */}
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
            ? baseDate.toLocaleDateString()
            : `${weekDays(baseDate)[0].toLocaleDateString()} – ${weekDays(baseDate)[6].toLocaleDateString()}`}
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

      {/* Timeline grid */}
      <div className="overflow-x-auto rounded-lg border bg-card">
        <div className="min-w-[320px] p-2">
          {/* Time / day labels */}
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
                  {d.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
              ))
            )}
          </div>

          {/* Lanes (rows) for this unit's bookings */}
          {withLanes.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No bookings in range</p>
          ) : (
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
      />
    </div>
  )
}
