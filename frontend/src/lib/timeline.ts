import type { BookingBlock } from '@/types/rooms'

/**
 * Assign each booking to a "lane" (row) so overlapping blocks are stacked.
 * Prevents overlaps in display; does not change data.
 */
export function assignLanes(bookings: BookingBlock[]): (BookingBlock & { lane: number })[] {
  const sorted = [...bookings].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  )
  const result: (BookingBlock & { lane: number })[] = []
  const lanes: { end: number }[] = []

  for (const b of sorted) {
    const start = new Date(b.start).getTime()
    const end = new Date(b.end).getTime()
    let lane = 0
    for (; lane < lanes.length; lane++) {
      if (lanes[lane].end <= start) break
    }
    if (lane === lanes.length) lanes.push({ end: 0 })
    lanes[lane].end = end
    result.push({ ...b, lane })
  }
  return result
}

/** Get start of day in local time (ISO string) */
export function startOfDay(date: Date): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

/** Get end of day (23:59:59.999) in local time (ISO string) */
export function endOfDay(date: Date): string {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d.toISOString()
}

/** Check if booking overlaps a date range [rangeStart, rangeEnd] */
export function bookingInRange(
  start: string,
  end: string,
  rangeStart: string,
  rangeEnd: string
): boolean {
  const s = new Date(start).getTime()
  const e = new Date(end).getTime()
  const rs = new Date(rangeStart).getTime()
  const re = new Date(rangeEnd).getTime()
  return s < re && e > rs
}

/** Get 7 days starting from a date */
export function weekDays(from: Date): Date[] {
  const out: Date[] = []
  const d = new Date(from)
  d.setHours(0, 0, 0, 0)
  for (let i = 0; i < 7; i++) {
    out.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return out
}
