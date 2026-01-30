/**
 * Placeholder data from Bahuleya Sample Excel.
 * Units: 2BHK A4, B1, B2, B3, B4, C2, C4; 3BHK C1.
 * Bookings: sample rows with From/To, Name, Event, Flats Assigned.
 * One overlap (Raina + Kohli same dates) on different units; B1 has two bookings to show stacking.
 */
import type { Room, BookingBlock } from '@/types/rooms'

const UNIT_CODES_2BHK = ['A4', 'B1', 'B2', 'B3', 'B4', 'C2', 'C4'] as const
const UNIT_CODES_3BHK = ['C1'] as const

function room(
  unit_code: string,
  room_type: '2BHK' | '3BHK',
  status: Room['status']
): Room {
  return { unit_code, room_type, status }
}

/** Mock rooms with status (placeholder: mix of statuses) */
export const MOCK_ROOMS: Room[] = [
  room('A4', '2BHK', 'Vacant'),
  room('B1', '2BHK', 'Reserved'),
  room('B2', '2BHK', 'Occupied'),
  room('B3', '2BHK', 'Vacant'),
  room('B4', '2BHK', 'Cleaning'),
  room('C2', '2BHK', 'Reserved'),
  room('C4', '2BHK', 'Hold'),
  room('C1', '3BHK', 'Occupied'),
]

/** Mock bookings from sample Excel (From/To, Name, Event, Flats Assigned). One conflict on B1 for demo. */
export const MOCK_BOOKINGS: BookingBlock[] = [
  {
    id: 'b1',
    unit_code: 'C2',
    guest_name: 'Dhoni',
    event_type: 'Marriage',
    start: '2026-01-29T00:00:00',
    end: '2026-02-03T00:00:00',
    status: 'reserved',
  },
  {
    id: 'b2',
    unit_code: 'B1',
    guest_name: 'Sachin',
    event_type: 'Office',
    start: '2026-06-09T08:00:00',
    end: '2026-06-13T08:00:00',
    status: 'reserved',
  },
  {
    id: 'b3',
    unit_code: 'C1',
    guest_name: 'Sachin',
    event_type: 'Office',
    start: '2026-06-09T08:00:00',
    end: '2026-06-13T08:00:00',
    status: 'reserved',
  },
  {
    id: 'b4',
    unit_code: 'A4',
    guest_name: 'Raina',
    event_type: 'Marriage',
    start: '2026-05-02T10:30:00',
    end: '2026-05-04T10:30:00',
    status: 'reserved',
  },
  {
    id: 'b5',
    unit_code: 'B1',
    guest_name: 'Kohli',
    event_type: 'Office',
    start: '2026-05-02T15:00:00',
    end: '2026-05-04T15:00:00',
    status: 'reserved',
  },
  {
    id: 'b6',
    unit_code: 'B1',
    guest_name: 'Rohit',
    event_type: 'Marriage',
    start: '2026-05-07T18:00:00',
    end: '2026-05-10T18:00:00',
    status: 'reserved',
  },
  {
    id: 'b7',
    unit_code: 'B2',
    guest_name: 'Rohit',
    event_type: 'Marriage',
    start: '2026-05-07T18:00:00',
    end: '2026-05-10T18:00:00',
    status: 'occupied',
  },
  // Overlap on same unit → conflict (imported data)
  {
    id: 'b8',
    unit_code: 'C4',
    guest_name: 'Conflict Guest A',
    event_type: null,
    start: '2026-06-01T00:00:00',
    end: '2026-06-03T00:00:00',
    status: 'reserved',
    isConflict: true,
  },
  {
    id: 'b9',
    unit_code: 'C4',
    guest_name: 'Conflict Guest B',
    event_type: null,
    start: '2026-06-02T12:00:00',
    end: '2026-06-04T12:00:00',
    status: 'reserved',
    isConflict: true,
  },
]

export function getBookingsForUnit(unitCode: string): BookingBlock[] {
  return MOCK_BOOKINGS.filter((b) => b.unit_code === unitCode)
}
