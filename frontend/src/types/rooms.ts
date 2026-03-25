/** Room/unit status for list and timeline */
export type RoomStatus =
  | 'Vacant'
  | 'Reserved'
  | 'Occupied'
  | 'Cleaning'
  | 'Hold'
  | 'Cancelled'

export interface Room {
  id: number
  unit_code: string
  room_type_id: number
  room_type: string
  is_active: boolean
  status: RoomStatus
}

export interface RoomType {
  id: number
  name: string
}

export interface BookingBlock {
  id: string | number
  unit_code: string
  guest_name: string
  event_type: string | null
  start: string // ISO datetime
  end: string
  status: 'reserved' | 'occupied' | 'checked_out' | 'cancelled'
  /** True when imported data has overlap (conflict) */
  isConflict?: boolean
}

export type TimelineView = 'day' | 'week'

/** API booking response */
export interface BookingResponse {
  id: number
  group_id: number
  room_id: number
  unit_code: string
  guest_name: string
  phone: string
  event_type: string | null
  start_datetime: string
  end_datetime: string
  status: string
  planned_checkin_time: string | null
  actual_checkin_time: string | null
  actual_checkout_time: string | null
  rate_snapshot: number | null
  group_total_rate: number
  total_paid: number
  balance: number
  created_at: string | null
}

export interface DashboardData {
  check_ins_today: number
  check_outs_today: number
  occupancy_count: number
  availability_count: number
  total_rooms: number
  pending_balances: number
}
