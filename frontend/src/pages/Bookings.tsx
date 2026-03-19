import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  CalendarDays,
  Plus,
  X,
  AlertCircle,
  LogIn,
  LogOut,
  XCircle,
  Search,
  IndianRupee,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BookingResponse, Room } from '@/types/rooms'

type SlotType = 'morning' | 'evening'

interface SelectedRoom {
  roomId: number
  rate: string
}

function computeSlotTimes(checkInDate: string, checkOutDate: string, slot: SlotType): { start: string; end: string } {
  if (!checkInDate || !checkOutDate) return { start: '', end: '' }
  const hour = slot === 'morning' ? 6 : 16
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    start: `${checkInDate}T${pad(hour)}:00`,
    end: `${checkOutDate}T${pad(hour)}:00`,
  }
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />
}

const STATUS_COLORS: Record<string, string> = {
  reserved: 'bg-blue-600/20 text-blue-400 border-blue-500/30',
  occupied: 'bg-amber-600/20 text-amber-400 border-amber-500/30',
  checked_out: 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30',
  cancelled: 'bg-muted text-muted-foreground',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold capitalize',
        STATUS_COLORS[status] ?? 'bg-muted text-muted-foreground'
      )}
    >
      {status.replace('_', ' ')}
    </span>
  )
}

function formatDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${formatDate(d)} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

function formatINR(n: number | null | undefined): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n)
}

// ---- Record Payment Modal ----
function RecordPaymentModal({
  booking,
  onClose,
  onSuccess,
}: {
  booking: BookingResponse
  onClose: () => void
  onSuccess: () => void
}) {
  const [amount, setAmount] = useState(booking.balance > 0 ? String(booking.balance) : '')
  const [paymentType, setPaymentType] = useState('Advance')
  const [paymentMode, setPaymentMode] = useState('Cash')
  const [paidAt, setPaidAt] = useState(() => {
    const now = new Date()
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
    return now.toISOString().slice(0, 16)
  })
  const [note, setNote] = useState('')

  const recordPayment = useMutation({
    mutationFn: (body: unknown) => api.post('/payments', body),
    onSuccess: () => {
      toast.success('Payment recorded')
      onSuccess()
      onClose()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    recordPayment.mutate({
      booking_group_id: booking.group_id,
      booking_id: booking.id,
      amount: Number(amount),
      payment_type: paymentType,
      payment_mode: paymentMode,
      paid_at: new Date(paidAt).toISOString(),
      note: note || null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Record Payment</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4 rounded-md border p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Guest</span>
              <span className="font-medium">{booking.guest_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Unit</span>
              <span>{booking.unit_code}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Room Rate</span>
              <span>{formatINR(booking.rate_snapshot)}</span>
            </div>
            {booking.group_total_rate !== booking.rate_snapshot && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Group Total</span>
                <span className="font-medium">{formatINR(booking.group_total_rate)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Paid so far</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">{formatINR(booking.total_paid)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Balance</span>
              <span className={cn('font-semibold', booking.balance > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>
                {formatINR(booking.balance)}
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Amount (INR) *</label>
              <input
                type="number"
                required
                min="1"
                step="1"
                placeholder="Enter amount"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Payment Type</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value)}
                >
                  <option value="Advance">Advance</option>
                  <option value="Check-in">Check-in</option>
                  <option value="Balance">Balance</option>
                  <option value="Refund">Refund</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Payment Mode</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank">Bank Transfer</option>
                </select>
              </div>
            </div>
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Payment Date *</label>
                <input
                  type="datetime-local"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={paidAt}
                  onChange={(e) => setPaidAt(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Note (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Token amount"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={recordPayment.isPending}>
                {recordPayment.isPending ? 'Recording...' : 'Record Payment'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

// ---- Checkout Confirmation Modal ----
function CheckoutConfirmModal({
  booking,
  onClose,
  onConfirm,
  isPending,
}: {
  booking: BookingResponse
  onClose: () => void
  onConfirm: () => void
  isPending: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <Card className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle className="text-lg">Confirm Check-out</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm space-y-2">
            <p>
              <span className="text-muted-foreground">Guest:</span>{' '}
              <span className="font-medium">{booking.guest_name}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Unit:</span> {booking.unit_code}
            </p>
          </div>

          {booking.balance > 0 ? (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm">
              <p className="font-semibold text-red-600 dark:text-red-400">
                Pending balance: {formatINR(booking.balance)}
              </p>
              <p className="mt-1 text-muted-foreground">
                Group Total: {formatINR(booking.group_total_rate)} &middot; Paid: {formatINR(booking.total_paid)}
              </p>
              <p className="mt-2 text-red-600 dark:text-red-400">
                Are you sure you want to check out with an unpaid balance?
              </p>
            </div>
          ) : (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
              <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                Fully paid &mdash; ready to check out.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button
              variant={booking.balance > 0 ? 'destructive' : 'default'}
              onClick={onConfirm}
              disabled={isPending}
            >
              {isPending ? 'Checking out...' : booking.balance > 0 ? 'Check out anyway' : 'Check out'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ---- Cancel Confirmation Modal ----
function CancelConfirmModal({
  booking,
  onClose,
  onConfirm,
  isPending,
}: {
  booking: BookingResponse
  onClose: () => void
  onConfirm: () => void
  isPending: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <Card className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle className="text-lg">Cancel Booking</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm space-y-2">
            <p>
              <span className="text-muted-foreground">Guest:</span>{' '}
              <span className="font-medium">{booking.guest_name}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Unit:</span> {booking.unit_code}
            </p>
          </div>

          {booking.total_paid > 0 ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm space-y-1">
              <p className="font-semibold text-amber-600 dark:text-amber-400">
                Advance paid: {formatINR(booking.total_paid)}
              </p>
              <p className="text-muted-foreground">
                Group Total: {formatINR(booking.group_total_rate)} &middot; Balance: {formatINR(booking.balance)}
              </p>
              <p className="mt-2 text-amber-600 dark:text-amber-400 font-medium">
                Please refund {formatINR(booking.total_paid)} to the guest.
              </p>
            </div>
          ) : (
            <div className="rounded-md border p-3 text-sm">
              <p className="text-muted-foreground">
                No payments have been made for this booking.
              </p>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            Are you sure you want to cancel this booking? This cannot be undone.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={isPending}>
              Keep Booking
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirm}
              disabled={isPending}
            >
              {isPending ? 'Cancelling...' : 'Cancel Booking'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ---- Main Bookings Page ----
export function Bookings() {
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()

  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? '')
  const [guestSearch, setGuestSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(
    searchParams.get('action') === 'new'
  )

  // Payment modal state
  const [paymentBooking, setPaymentBooking] = useState<BookingResponse | null>(null)

  // Checkout confirmation state
  const [checkoutBooking, setCheckoutBooking] = useState<BookingResponse | null>(null)

  // Cancel confirmation state
  const [cancelBooking, setCancelBooking] = useState<BookingResponse | null>(null)

  // Create form state
  const [formGuestName, setFormGuestName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formEventType, setFormEventType] = useState('')
  const [formSlot, setFormSlot] = useState<SlotType>('morning')
  const [formCheckInDate, setFormCheckInDate] = useState('')
  const [formCheckOutDate, setFormCheckOutDate] = useState('')
  const [formStart, setFormStart] = useState('')
  const [formEnd, setFormEnd] = useState('')
  const [formRooms, setFormRooms] = useState<SelectedRoom[]>([])

  // ---- Queries ----
  const bookingsQuery = useQuery({
    queryKey: ['bookings', statusFilter, guestSearch],
    queryFn: () => {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (guestSearch) params.set('guest', guestSearch)
      params.set('limit', '200')
      return api.get<BookingResponse[]>(`/bookings?${params.toString()}`)
    },
  })

  const roomsQuery = useQuery({
    queryKey: ['rooms'],
    queryFn: () => api.get<Room[]>('/rooms'),
    staleTime: 5 * 60_000,
  })

  const rooms = roomsQuery.data ?? []
  const bookings = bookingsQuery.data ?? []

  // Group bookings by group_id for display
  const groupedBookings = useMemo(() => {
    const map = new Map<number, BookingResponse[]>()
    for (const b of bookings) {
      const arr = map.get(b.group_id)
      if (arr) arr.push(b)
      else map.set(b.group_id, [b])
    }
    let groups = Array.from(map.values())
    if (dateFilter) {
      groups = groups.filter((group) =>
        group.some((b) => b.start_datetime.slice(0, 10) === dateFilter)
      )
    }
    return groups
  }, [bookings, dateFilter])

  // ---- Mutations ----
  const createBooking = useMutation({
    mutationFn: (body: unknown) => api.post('/bookings', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      toast.success('Booking created')
      resetForm()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const checkinMutation = useMutation({
    mutationFn: (id: number) => api.post(`/bookings/${id}/checkin`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      toast.success('Checked in')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const checkoutMutation = useMutation({
    mutationFn: (id: number) => api.post(`/bookings/${id}/checkout`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      setCheckoutBooking(null)
      toast.success('Checked out')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/bookings/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      setCancelBooking(null)
      toast.success('Booking cancelled')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  function resetForm() {
    setFormGuestName('')
    setFormPhone('')
    setFormEventType('')
    setFormSlot('morning')
    setFormCheckInDate('')
    setFormCheckOutDate('')
    setFormStart('')
    setFormEnd('')
    setFormRooms([])
    setShowCreateForm(false)
  }

  function handleDateOrSlotChange(checkIn: string, checkOut: string, slot: SlotType) {
    setFormSlot(slot)
    setFormCheckInDate(checkIn)
    setFormCheckOutDate(checkOut)
    const times = computeSlotTimes(checkIn, checkOut, slot)
    setFormStart(times.start)
    setFormEnd(times.end)
  }

  function toggleRoom(roomId: number) {
    setFormRooms((prev) => {
      const exists = prev.find((r) => r.roomId === roomId)
      if (exists) return prev.filter((r) => r.roomId !== roomId)
      return [...prev, { roomId, rate: '' }]
    })
  }

  function updateRoomRate(roomId: number, rate: string) {
    setFormRooms((prev) =>
      prev.map((r) => (r.roomId === roomId ? { ...r, rate } : r))
    )
  }

  const numNights = (() => {
    if (!formCheckInDate || !formCheckOutDate) return 1
    const diff = new Date(formCheckOutDate).getTime() - new Date(formCheckInDate).getTime()
    const days = Math.round(diff / (1000 * 60 * 60 * 24))
    return days > 0 ? days : 1
  })()

  const formTotal = formRooms.reduce((sum, r) => sum + (Number(r.rate) || 0) * numNights, 0)

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (formRooms.length === 0) {
      toast.error('Select at least one room')
      return
    }
    const startDt = formStart ? new Date(formStart).toISOString() : ''
    const endDt = formEnd ? new Date(formEnd).toISOString() : ''
    createBooking.mutate({
      group: {
        guest_name: formGuestName,
        phone: formPhone,
        event_type: formEventType || null,
      },
      bookings: formRooms.map((r) => ({
        room_id: r.roomId,
        start_datetime: startDt,
        end_datetime: endDt,
        rate_snapshot: r.rate ? Number(r.rate) * numNights : null,
      })),
    })
  }

  function handleCheckoutClick(b: BookingResponse) {
    // Always show confirmation modal
    setCheckoutBooking(b)
  }

  const isPending =
    checkinMutation.isPending || checkoutMutation.isPending || cancelMutation.isPending

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Bookings</h1>
        <Button size="sm" onClick={() => setShowCreateForm(true)}>
          <Plus className="size-4" />
          New Booking
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search guest..."
            className="h-9 rounded-md border border-input bg-background pl-8 pr-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={guestSearch}
            onChange={(e) => setGuestSearch(e.target.value)}
          />
        </div>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="reserved">Reserved</option>
          <option value="occupied">Occupied</option>
          <option value="checked_out">Checked out</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <input
          type="date"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          onClick={(e) => { try { (e.target as HTMLInputElement).showPicker() } catch {} }}
          title="Filter by check-in date"
        />
        {dateFilter && (
          <Button variant="ghost" size="sm" className="h-9 px-2 text-muted-foreground" onClick={() => setDateFilter('')}>
            <X className="size-4" />
          </Button>
        )}
      </div>

      {bookingsQuery.isError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span>Failed to load bookings: {(bookingsQuery.error as Error)?.message}</span>
        </div>
      )}

      {/* Bookings list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="size-5" />
            Bookings
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {bookingsQuery.isLoading && (
            <div className="space-y-1 p-4">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          )}

          {!bookingsQuery.isLoading && groupedBookings.length === 0 && (
            <p className="p-6 text-center text-muted-foreground">
              No bookings found.
            </p>
          )}

          {groupedBookings.length > 0 && (
            <div className="divide-y divide-border">
              {groupedBookings.map((group) => {
                const first = group[0]
                const isMulti = group.length > 1
                const hasActive = group.some((b) => b.status !== 'cancelled' && b.status !== 'checked_out')

                return (
                  <div
                    key={first.group_id}
                    className="px-6 py-4 space-y-3"
                  >
                    {/* Group header */}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{first.guest_name}</span>
                          {isMulti && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                              {group.length} rooms
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                          <span>{formatDateTime(first.start_datetime)} → {formatDateTime(first.end_datetime)}</span>
                          {first.event_type && <span>Event: {first.event_type}</span>}
                          {first.phone && <span>Ph: {first.phone}</span>}
                        </div>

                        {/* Group-level payment summary */}
                        {first.group_total_rate > 0 && first.status !== 'cancelled' && (
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs pt-0.5">
                            <span className="text-muted-foreground">
                              Total: <span className="font-medium text-foreground">{formatINR(first.group_total_rate)}</span>
                            </span>
                            <span className="text-muted-foreground">
                              Paid: <span className="font-medium text-emerald-600 dark:text-emerald-400">{formatINR(first.total_paid)}</span>
                            </span>
                            <span className="text-muted-foreground">
                              Balance:{' '}
                              <span
                                className={cn(
                                  'font-semibold',
                                  first.balance > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                                )}
                              >
                                {formatINR(first.balance)}
                              </span>
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Group-level actions (pay button works at group level) */}
                      <div className="flex shrink-0 gap-1.5">
                        {hasActive && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPaymentBooking(first)}
                            title="Record payment"
                          >
                            <IndianRupee className="size-3.5" />
                            <span className="hidden sm:inline">Pay</span>
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Per-unit rows */}
                    <div className={cn('space-y-1', isMulti && 'ml-2 border-l-2 border-border pl-3')}>
                      {group.map((b) => (
                        <div
                          key={b.id}
                          className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-2 text-sm min-w-0">
                            <span className="font-medium shrink-0">{b.unit_code}</span>
                            <StatusBadge status={b.status} />
                            {b.rate_snapshot != null && (
                              <span className="text-xs text-muted-foreground">{formatINR(b.rate_snapshot)}</span>
                            )}
                          </div>

                          <div className="flex shrink-0 gap-1">
                            {b.status === 'reserved' && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isPending}
                                onClick={() => checkinMutation.mutate(b.id)}
                                title="Check-in"
                                className="h-7 px-2 text-xs"
                              >
                                <LogIn className="size-3" />
                                <span className="hidden sm:inline ml-1">Check-in</span>
                              </Button>
                            )}
                            {b.status === 'occupied' && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isPending}
                                onClick={() => handleCheckoutClick(b)}
                                title="Check-out"
                                className="h-7 px-2 text-xs"
                              >
                                <LogOut className="size-3" />
                                <span className="hidden sm:inline ml-1">Check-out</span>
                              </Button>
                            )}
                            {b.status !== 'cancelled' && b.status !== 'checked_out' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={isPending}
                                onClick={() => setCancelBooking(b)}
                                title="Cancel"
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              >
                                <XCircle className="size-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create booking modal */}
      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={resetForm}>
          <Card className="w-full max-w-lg max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">New Booking</CardTitle>
              <Button variant="ghost" size="icon" onClick={resetForm}>
                <X className="size-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                {/* Guest info */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Guest Name *</label>
                    <input
                      type="text"
                      required
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={formGuestName}
                      onChange={(e) => setFormGuestName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Phone *</label>
                    <input
                      type="tel"
                      required
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Event Type</label>
                  <input
                    type="text"
                    placeholder="e.g. Marriage, Office"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={formEventType}
                    onChange={(e) => setFormEventType(e.target.value)}
                  />
                </div>

                {/* Check-in / Check-out / Slot */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Check-in Date *</label>
                    <input
                      type="date"
                      required
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                      value={formCheckInDate}
                      onChange={(e) => handleDateOrSlotChange(e.target.value, formCheckOutDate, formSlot)}
                      onClick={(e) => { try { (e.target as HTMLInputElement).showPicker() } catch {} }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Check-out Date *</label>
                    <input
                      type="date"
                      required
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                      value={formCheckOutDate}
                      onChange={(e) => handleDateOrSlotChange(formCheckInDate, e.target.value, formSlot)}
                      onClick={(e) => { try { (e.target as HTMLInputElement).showPicker() } catch {} }}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Slot *</label>
                  <select
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={formSlot}
                    onChange={(e) => handleDateOrSlotChange(formCheckInDate, formCheckOutDate, e.target.value as SlotType)}
                  >
                    <option value="morning">Morning (6 AM)</option>
                    <option value="evening">Evening (4 PM)</option>
                  </select>
                </div>
                {formStart && formEnd && (
                  <p className="text-xs text-muted-foreground -mt-2">
                    {formatDateTime(formStart)}
                    {' → '}
                    {formatDateTime(formEnd)}
                  </p>
                )}

                {/* Room selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Select Rooms * ({formRooms.length} selected)
                  </label>
                  <div className="space-y-2 rounded-md border p-3">
                    {rooms.map((room) => {
                      const selected = formRooms.find((r) => r.roomId === room.id)
                      return (
                        <div key={room.id} className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            id={`room-${room.id}`}
                            checked={!!selected}
                            onChange={() => toggleRoom(room.id)}
                            className="size-4 rounded border-input accent-primary"
                          />
                          <label
                            htmlFor={`room-${room.id}`}
                            className="flex flex-1 items-center justify-between text-sm cursor-pointer"
                          >
                            <span>
                              <span className="font-medium">{room.unit_code}</span>
                              <span className="ml-1.5 text-muted-foreground">({room.room_type})</span>
                            </span>
                          </label>
                          {selected && (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                required
                                min="0"
                                step="1"
                                placeholder="Rate/night"
                                className="h-8 w-28 rounded-md border border-input bg-background px-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                value={selected.rate}
                                onChange={(e) => updateRoomRate(room.id, e.target.value)}
                              />
                              {numNights > 1 && selected.rate && (
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  × {numNights} days = {formatINR(Number(selected.rate) * numNights)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Total */}
                {formRooms.length > 0 && (
                  <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
                    <span className="font-medium">Total ({formRooms.length} room{formRooms.length > 1 ? 's' : ''}{numNights > 1 ? `, ${numNights} days` : ''})</span>
                    <span className="text-lg font-bold">{formatINR(formTotal)}</span>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createBooking.isPending || formRooms.length === 0}>
                    {createBooking.isPending ? 'Creating...' : 'Create Booking'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Record Payment modal */}
      {paymentBooking && (
        <RecordPaymentModal
          booking={paymentBooking}
          onClose={() => setPaymentBooking(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['bookings'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard'] })
          }}
        />
      )}

      {/* Checkout confirmation modal */}
      {checkoutBooking && (
        <CheckoutConfirmModal
          booking={checkoutBooking}
          onClose={() => setCheckoutBooking(null)}
          onConfirm={() => checkoutMutation.mutate(checkoutBooking.id)}
          isPending={checkoutMutation.isPending}
        />
      )}

      {/* Cancel confirmation modal */}
      {cancelBooking && (
        <CancelConfirmModal
          booking={cancelBooking}
          onClose={() => setCancelBooking(null)}
          onConfirm={() => cancelMutation.mutate(cancelBooking.id)}
          isPending={cancelMutation.isPending}
        />
      )}
    </div>
  )
}
