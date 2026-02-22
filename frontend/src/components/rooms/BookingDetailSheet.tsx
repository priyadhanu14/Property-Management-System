import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { X, IndianRupee } from 'lucide-react'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { BookingBlock, BookingResponse } from '@/types/rooms'

interface BookingDetailSheetProps {
  booking: BookingBlock | null
  onClose: () => void
  onActionDone?: () => void
  open: boolean
}

function formatDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function formatRange(start: string, end: string): string {
  const d1 = new Date(start)
  const d2 = new Date(end)
  return `${formatDate(d1)} ${d1.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${formatDate(d2)} ${d2.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

function formatINR(n: number | null | undefined): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n)
}

// ---- Inline Record Payment Form ----
function RecordPaymentForm({
  bookingDetail,
  onClose,
  onSuccess,
}: {
  bookingDetail: BookingResponse
  onClose: () => void
  onSuccess: () => void
}) {
  const [amount, setAmount] = useState(
    bookingDetail.balance > 0 ? String(bookingDetail.balance) : ''
  )
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
      booking_group_id: bookingDetail.group_id,
      booking_id: bookingDetail.id,
      amount: Number(amount),
      payment_type: paymentType,
      payment_mode: paymentMode,
      paid_at: new Date(paidAt).toISOString(),
      note: note || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-md border p-3 bg-muted/30">
      <p className="text-sm font-medium">Record Payment</p>
      <div className="grid gap-2 grid-cols-2">
        <input
          type="number"
          required
          min="1"
          step="1"
          placeholder="Amount"
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <select
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={paymentType}
          onChange={(e) => setPaymentType(e.target.value)}
        >
          <option value="Advance">Advance</option>
          <option value="Check-in">Check-in</option>
          <option value="Balance">Balance</option>
          <option value="Refund">Refund</option>
        </select>
      </div>
      <div className="grid gap-2 grid-cols-2">
        <select
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={paymentMode}
          onChange={(e) => setPaymentMode(e.target.value)}
        >
          <option value="Cash">Cash</option>
          <option value="UPI">UPI</option>
          <option value="Bank">Bank Transfer</option>
        </select>
        <input
          type="datetime-local"
          required
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={paidAt}
          onChange={(e) => setPaidAt(e.target.value)}
        />
      </div>
      <input
        type="text"
        placeholder="Note (optional)"
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={recordPayment.isPending}>
          {recordPayment.isPending ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </form>
  )
}

export function BookingDetailSheet({ booking, onClose, onActionDone, open }: BookingDetailSheetProps) {
  const queryClient = useQueryClient()
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [showCheckoutConfirm, setShowCheckoutConfirm] = useState(false)

  // Fetch full booking detail (with total_paid/balance) from API
  const detailQuery = useQuery({
    queryKey: ['booking-detail', booking?.id],
    queryFn: () => api.get<BookingResponse>(`/bookings/${booking!.id}`),
    enabled: !!booking && open,
    staleTime: 5_000,
  })

  const detail = detailQuery.data

  const checkin = useMutation({
    mutationFn: (id: number | string) => api.post(`/bookings/${id}/checkin`, {}),
    onSuccess: () => {
      toast.success('Checked in successfully')
      queryClient.invalidateQueries({ queryKey: ['booking-detail', booking?.id] })
      onActionDone?.()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const checkout = useMutation({
    mutationFn: (id: number | string) => api.post(`/bookings/${id}/checkout`, {}),
    onSuccess: () => {
      toast.success('Checked out successfully')
      setShowCheckoutConfirm(false)
      queryClient.invalidateQueries({ queryKey: ['booking-detail', booking?.id] })
      onActionDone?.()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const cancel = useMutation({
    mutationFn: (id: number | string) => api.delete(`/bookings/${id}`),
    onSuccess: () => {
      toast.success('Booking cancelled')
      queryClient.invalidateQueries({ queryKey: ['booking-detail', booking?.id] })
      onActionDone?.()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (!booking) return null

  const isPending = checkin.isPending || checkout.isPending || cancel.isPending

  function handleCheckoutClick() {
    setShowCheckoutConfirm(true)
  }

  function confirmCheckout() {
    checkout.mutate(booking!.id)
  }

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 transition-opacity',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden
      />
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50 rounded-t-xl border bg-card shadow-lg transition-transform duration-200 ease-out',
          open ? 'translate-y-0' : 'translate-y-full'
        )}
      >
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="font-semibold">Booking details</h3>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>
        <div className="max-h-[70vh] overflow-auto p-4 space-y-3">
          {booking.isConflict && (
            <p className="text-sm text-red-400 bg-red-500/10 rounded-md p-2">
              Conflict — overlapping booking. Resolve by adjusting dates.
            </p>
          )}
          <div className="grid grid-cols-[100px_1fr] gap-y-2 text-sm">
            <span className="text-muted-foreground">Unit</span>
            <span>{booking.unit_code}</span>
            <span className="text-muted-foreground">Guest</span>
            <span className="font-medium">{booking.guest_name}</span>
            {booking.event_type && (
              <>
                <span className="text-muted-foreground">Event</span>
                <span>{booking.event_type}</span>
              </>
            )}
            <span className="text-muted-foreground">Time</span>
            <span>{formatRange(booking.start, booking.end)}</span>
            <span className="text-muted-foreground">Status</span>
            <span className="capitalize font-medium">{booking.status}</span>
          </div>

          {/* Payment info */}
          {detail && detail.rate_snapshot != null && booking.status !== 'cancelled' && (
            <div className="rounded-md border p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Room Rate</span>
                <span className="font-medium">{formatINR(detail.rate_snapshot)}</span>
              </div>
              {detail.group_total_rate !== detail.rate_snapshot && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Group Total</span>
                  <span className="font-medium">{formatINR(detail.group_total_rate)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  {formatINR(detail.total_paid)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Balance</span>
                <span
                  className={cn(
                    'font-semibold',
                    detail.balance > 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  )}
                >
                  {formatINR(detail.balance)}
                </span>
              </div>
            </div>
          )}

          {/* Inline payment form */}
          {showPaymentForm && detail && (
            <RecordPaymentForm
              bookingDetail={detail}
              onClose={() => setShowPaymentForm(false)}
              onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ['booking-detail', booking?.id] })
                queryClient.invalidateQueries({ queryKey: ['bookings'] })
                queryClient.invalidateQueries({ queryKey: ['dashboard'] })
              }}
            />
          )}

          {/* Checkout confirmation inline */}
          {showCheckoutConfirm && detail && (
            <div
              className={cn(
                'rounded-md border p-3 text-sm space-y-2',
                detail.balance > 0
                  ? 'border-red-500/30 bg-red-500/10'
                  : 'border-emerald-500/30 bg-emerald-500/10'
              )}
            >
              {detail.balance > 0 ? (
                <>
                  <p className="font-semibold text-red-600 dark:text-red-400">
                    Pending balance: {formatINR(detail.balance)}
                  </p>
                  <p className="text-muted-foreground">
                    Are you sure you want to check out with an unpaid balance?
                  </p>
                </>
              ) : (
                <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                  Fully paid — ready to check out.
                </p>
              )}
              <div className="flex gap-2 justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowCheckoutConfirm(false)}
                  disabled={checkout.isPending}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant={detail.balance > 0 ? 'destructive' : 'default'}
                  onClick={confirmCheckout}
                  disabled={checkout.isPending}
                >
                  {checkout.isPending
                    ? 'Checking out...'
                    : detail.balance > 0
                      ? 'Check out anyway'
                      : 'Confirm check-out'}
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 p-4 border-t">
          {/* Record Payment */}
          {booking.status !== 'cancelled' && booking.status !== 'checked_out' && !showPaymentForm && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowPaymentForm(true)
                setShowCheckoutConfirm(false)
              }}
            >
              <IndianRupee className="size-3.5 mr-1" />
              Record Payment
            </Button>
          )}
          {booking.status === 'reserved' && (
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => checkin.mutate(booking.id)}
            >
              {checkin.isPending ? 'Checking in...' : 'Check-in'}
            </Button>
          )}
          {booking.status === 'occupied' && !showCheckoutConfirm && (
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={handleCheckoutClick}
            >
              Check-out
            </Button>
          )}
          {booking.status !== 'cancelled' && booking.status !== 'checked_out' && (
            <Button
              size="sm"
              variant="destructive"
              disabled={isPending}
              onClick={() => cancel.mutate(booking.id)}
            >
              {cancel.isPending ? 'Cancelling...' : 'Cancel booking'}
            </Button>
          )}
        </div>
      </div>
    </>
  )
}
