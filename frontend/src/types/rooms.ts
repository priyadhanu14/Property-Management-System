/** Room/unit status for list and timeline */
export type RoomStatus =
  | 'Vacant'
  | 'Reserved'
  | 'Occupied'
  | 'Cleaning'
  | 'Hold'
  | 'Cancelled'

export interface Room {
  unit_code: string
  room_type: '2BHK' | '3BHK'
  status: RoomStatus
}

export interface BookingBlock {
  id: string
  unit_code: string
  guest_name: string
  event_type: string | null
  start: string // ISO datetime
  end: string
  status: 'reserved' | 'occupied' | 'cancelled'
  /** True when imported data has overlap (conflict) */
  isConflict?: boolean
}

export type TimelineView = 'day' | 'week'
