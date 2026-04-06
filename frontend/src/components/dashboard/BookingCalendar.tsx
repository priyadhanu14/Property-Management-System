import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { BookingResponse } from '@/types/rooms'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']


interface CalendarDay {
  date: Date
  isCurrentMonth: boolean
  isToday: boolean
}

function getMonthGrid(year: number, month: number): CalendarDay[] {
  const today = new Date()
  const first = new Date(year, month, 1)
  const startDay = first.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const days: CalendarDay[] = []

  // Previous month fill
  const prevMonthDays = new Date(year, month, 0).getDate()
  for (let i = startDay - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, prevMonthDays - i)
    days.push({ date: d, isCurrentMonth: false, isToday: isSameDay(d, today) })
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month, d)
    days.push({ date: dt, isCurrentMonth: true, isToday: isSameDay(dt, today) })
  }

  // Next month fill (complete last row)
  const remaining = 7 - (days.length % 7)
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const dt = new Date(year, month + 1, d)
      days.push({ date: dt, isCurrentMonth: false, isToday: isSameDay(dt, today) })
    }
  }

  return days
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface GroupedBooking {
  groupId: number
  guestName: string
  units: string[]
  status: string
  start: Date
  end: Date
}

export interface EnquiryOut {
  id: number
  room_id: number | null
  unit_code: string | null
  guest_name: string
  phone: string
  enquiry_date: string
  notes: string | null
}

interface BookingCalendarProps {
  onAddEnquiry?: (date: string) => void
  onDeleteEnquiry?: (id: number) => void
  enquiryRefetchKey?: number
}

export function BookingCalendar({ onAddEnquiry, onDeleteEnquiry, enquiryRefetchKey }: BookingCalendarProps) {
  const [viewDate, setViewDate] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })

  const monthLabel = new Date(viewDate.year, viewDate.month).toLocaleString('en-IN', {
    month: 'long',
    year: 'numeric',
  })

  function prevMonth() {
    setViewDate((v) => {
      const d = new Date(v.year, v.month - 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  function nextMonth() {
    setViewDate((v) => {
      const d = new Date(v.year, v.month + 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  function goToday() {
    const now = new Date()
    setViewDate({ year: now.getFullYear(), month: now.getMonth() })
  }

  const fromDate = toDateStr(new Date(viewDate.year, viewDate.month, 1))
  const toDate = toDateStr(new Date(viewDate.year, viewDate.month + 1, 0))

  const { data: bookings } = useQuery({
    queryKey: ['calendar-bookings', fromDate, toDate],
    queryFn: () =>
      api.get<BookingResponse[]>(
        `/bookings?from_date=${fromDate}&to_date=${toDate}&limit=500`
      ),
    staleTime: 30_000,
  })

  const { data: enquiries } = useQuery({
    queryKey: ['calendar-enquiries', fromDate, toDate, enquiryRefetchKey],
    queryFn: () =>
      api.get<EnquiryOut[]>(`/enquiries?from_date=${fromDate}&to_date=${toDate}`),
    staleTime: 30_000,
  })

  const { data: rooms } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => api.get<{ id: number; unit_code: string; room_type: string; is_active: boolean }[]>('/rooms'),
    staleTime: 5 * 60_000,
  })

  const activeRooms = (rooms ?? []).filter((r) => r.is_active)

  // unit_code → room_type (e.g. "B1" → "2BHK")
  const unitToType = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of activeRooms) map.set(r.unit_code, r.room_type)
    return map
  }, [activeRooms])

  // room_type → total count (e.g. "2BHK" → 5)
  const typeTotals = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of activeRooms) map.set(r.room_type, (map.get(r.room_type) ?? 0) + 1)
    return map
  }, [activeRooms])

  // Group by group_id and map to calendar-friendly objects
  const grouped = useMemo(() => {
    if (!bookings) return []
    const map = new Map<number, BookingResponse[]>()
    for (const b of bookings) {
      if (b.status === 'cancelled') continue
      const arr = map.get(b.group_id)
      if (arr) arr.push(b)
      else map.set(b.group_id, [b])
    }
    const result: GroupedBooking[] = []
    for (const [groupId, items] of map) {
      const first = items[0]
      result.push({
        groupId,
        guestName: first.guest_name,
        units: items.map((i) => i.unit_code),
        status: first.status,
        start: new Date(first.start_datetime),
        end: new Date(first.end_datetime),
      })
    }
    return result
  }, [bookings])

  const days = getMonthGrid(viewDate.year, viewDate.month)

  function bookingsForDay(day: Date): GroupedBooking[] {
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate())
    const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)
    return grouped.filter((g) => g.start < dayEnd && g.end > dayStart)
  }

  function enquiriesForDay(day: Date): EnquiryOut[] {
    const dateStr = toDateStr(day)
    return (enquiries ?? []).filter((e) => e.enquiry_date === dateStr)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={goToday} className="text-xs h-7 px-2">
            Today
          </Button>
          <Button variant="ghost" size="icon" className="size-7" onClick={prevMonth}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-7" onClick={nextMonth}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <h2 className="text-base font-semibold">{monthLabel}</h2>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 text-center text-[11px] font-medium text-muted-foreground mb-1">
        {DAY_LABELS.map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 flex-1 border-t border-l border-border">
        {days.map((day, i) => {
          const dayBookings = bookingsForDay(day.date)
          const dayEnquiries = enquiriesForDay(day.date)
          const dateStr = toDateStr(day.date)
          return (
            <div
              key={i}
              className={cn(
                'border-r border-b border-border min-h-[70px] p-1 text-xs overflow-hidden',
                !day.isCurrentMonth && 'bg-muted/30 text-muted-foreground',
                onAddEnquiry && 'cursor-pointer hover:bg-muted/20 transition-colors'
              )}
              onClick={() => onAddEnquiry?.(dateStr)}
            >
              <div
                className={cn(
                  'inline-flex items-center justify-center size-6 rounded-full text-[11px] font-medium mb-0.5',
                  day.isToday && 'bg-primary text-primary-foreground'
                )}
              >
                {day.date.getDate()}
              </div>
              <div className="space-y-0.5">
                {(() => {
                  const bookedByType = new Map<string, number>()
                  const uniqueUnits = new Set(dayBookings.flatMap((g) => g.units))
                  for (const unit of uniqueUnits) {
                    const type = unitToType.get(unit)
                    if (type) bookedByType.set(type, (bookedByType.get(type) ?? 0) + 1)
                  }
                  if (bookedByType.size === 0) return null
                  return (
                    <div
                      className="flex flex-wrap gap-0.5"
                      title={dayBookings.map(g => `${g.guestName} · ${g.units.join(', ')}`).join('\n')}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {Array.from(typeTotals.entries()).sort().map(([type, total]) => {
                        const booked = bookedByType.get(type) ?? 0
                        if (booked === 0) return null
                        const isFull = booked >= total
                        const isHalf = booked >= total / 2
                        return (
                          <div
                            key={type}
                            className={cn(
                              'rounded px-1 py-px text-[10px] leading-tight font-semibold',
                              isFull
                                ? 'bg-red-500/80 text-white'
                                : isHalf
                                ? 'bg-amber-500/80 text-white'
                                : 'bg-emerald-500/70 text-white'
                            )}
                          >
                            {type}: {booked}/{total}
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
                {dayEnquiries.slice(0, 2).map((enq) => (
                  <div
                    key={`enq-${enq.id}`}
                    className="group flex items-center justify-between rounded px-1 py-px text-[10px] leading-tight font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30"
                    title={`Enquiry: ${enq.guest_name} · ${enq.phone}${enq.unit_code ? ` · ${enq.unit_code}` : ''}${enq.notes ? ` · ${enq.notes}` : ''}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="truncate">📞 {enq.guest_name.split(' ')[0]}{enq.unit_code ? ` · ${enq.unit_code}` : ''}</span>
                    {onDeleteEnquiry && (
                      <button
                        className="ml-0.5 shrink-0 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); onDeleteEnquiry(enq.id) }}
                        title="Delete enquiry"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                {dayEnquiries.length > 2 && (
                  <div className="text-[10px] text-muted-foreground pl-1">+{dayEnquiries.length - 2} more</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
