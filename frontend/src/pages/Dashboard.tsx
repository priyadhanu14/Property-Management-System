import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '@/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  CalendarCheck,
  CalendarX,
  Building2,
  IndianRupee,
  AlertCircle,
  Home,
  Plus,
  LogIn,
  LogOut,
  Wallet,
  Phone,
  X,
} from 'lucide-react'
import type { DashboardData, Room } from '@/types/rooms'
import { BookingCalendar } from '@/components/dashboard/BookingCalendar'

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n)
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />
}

function getCurrentDateStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function Dashboard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['dashboard-today'],
    queryFn: () => api.get<DashboardData>('/dashboard/today'),
    refetchInterval: 60_000,
  })

  // Enquiry modal state
  const [showEnquiryForm, setShowEnquiryForm] = useState(false)
  const [enquiryDate, setEnquiryDate] = useState(getCurrentDateStr)
  const [enquiryName, setEnquiryName] = useState('')
  const [enquiryPhone, setEnquiryPhone] = useState('')
  const [enquiryRoomId, setEnquiryRoomId] = useState('')
  const [enquiryNotes, setEnquiryNotes] = useState('')
  // Key to trigger enquiry refetch in calendar after creation
  const [enquiryRefetchKey, setEnquiryRefetchKey] = useState(0)

  const roomsQuery = useQuery({
    queryKey: ['rooms'],
    queryFn: () => api.get<Room[]>('/rooms'),
    staleTime: 5 * 60_000,
  })
  const rooms = roomsQuery.data ?? []

  const createEnquiry = useMutation({
    mutationFn: (body: {
      room_id: number | null
      guest_name: string
      phone: string
      enquiry_date: string
      notes: string | null
    }) => api.post('/enquiries', body),
    onSuccess: () => {
      toast.success('Enquiry logged')
      setEnquiryRefetchKey((k) => k + 1)
      queryClient.invalidateQueries({ queryKey: ['calendar-enquiries'] })
      resetEnquiryForm()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  function openEnquiryForm(date?: string) {
    setEnquiryDate(date ?? getCurrentDateStr())
    setShowEnquiryForm(true)
  }

  function resetEnquiryForm() {
    setEnquiryName('')
    setEnquiryPhone('')
    setEnquiryRoomId('')
    setEnquiryNotes('')
    setEnquiryDate(getCurrentDateStr())
    setShowEnquiryForm(false)
  }

  function handleEnquirySubmit(e: React.FormEvent) {
    e.preventDefault()
    createEnquiry.mutate({
      room_id: enquiryRoomId ? Number(enquiryRoomId) : null,
      guest_name: enquiryName,
      phone: enquiryPhone,
      enquiry_date: enquiryDate,
      notes: enquiryNotes || null,
    })
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {isError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span>Failed to load dashboard: {(error as Error)?.message ?? 'Unknown error'}</span>
        </div>
      )}

      {/* Two-column layout: Calendar left, Quick Actions + KPIs right */}
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        {/* Left: Calendar */}
        <Card className="min-h-[480px]">
          <CardContent className="p-3 sm:p-4 h-full">
            <BookingCalendar
              onAddEnquiry={(date) => openEnquiryForm(date)}
              enquiryRefetchKey={enquiryRefetchKey}
            />
          </CardContent>
        </Card>

        {/* Right: Quick Actions (top) + Summary KPIs (bottom) */}
        <div className="flex flex-col gap-4">
          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => navigate('/bookings?action=new')}
                className="h-auto flex-col gap-1 py-3"
              >
                <Plus className="size-4" />
                <span className="text-xs">New Booking</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/bookings?status=reserved')}
                className="h-auto flex-col gap-1 py-3"
              >
                <LogIn className="size-4" />
                <span className="text-xs">Check-in</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/bookings?status=occupied')}
                className="h-auto flex-col gap-1 py-3"
              >
                <LogOut className="size-4" />
                <span className="text-xs">Check-out</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/accounts')}
                className="h-auto flex-col gap-1 py-3"
              >
                <Wallet className="size-4" />
                <span className="text-xs">Payments</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => openEnquiryForm()}
                className="col-span-2 h-auto flex-col gap-1 py-3"
              >
                <Phone className="size-4" />
                <span className="text-xs">Log Enquiry</span>
              </Button>
            </CardContent>
          </Card>

          {/* Summary KPIs */}
          <Card className="flex-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Today&apos;s Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <KpiRow
                icon={<CalendarCheck className="size-4 text-blue-500" />}
                label="Check-ins"
                value={isLoading ? null : String(data?.check_ins_today ?? 0)}
                sub="Arriving today"
              />
              <KpiRow
                icon={<CalendarX className="size-4 text-orange-500" />}
                label="Check-outs"
                value={isLoading ? null : String(data?.check_outs_today ?? 0)}
                sub="Departing today"
              />
              <KpiRow
                icon={<Building2 className="size-4 text-amber-500" />}
                label="Occupied"
                value={isLoading ? null : `${data?.occupancy_count ?? 0} / ${data?.total_rooms ?? 0}`}
                sub="Rooms in use"
              />
              <KpiRow
                icon={<Home className="size-4 text-emerald-500" />}
                label="Available"
                value={isLoading ? null : String(data?.availability_count ?? 0)}
                sub="Vacant units"
                valueClassName="text-emerald-600 dark:text-emerald-400"
              />
              <KpiRow
                icon={<IndianRupee className="size-4 text-red-500" />}
                label="Pending"
                value={isLoading ? null : formatCurrency(data?.pending_balances ?? 0)}
                sub="Outstanding balances"
                valueClassName="text-red-600 dark:text-red-400"
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Log Enquiry modal */}
      {showEnquiryForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={resetEnquiryForm}
        >
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Log Enquiry</CardTitle>
              <Button variant="ghost" size="icon" onClick={resetEnquiryForm}>
                <X className="size-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleEnquirySubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="Guest name"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={enquiryName}
                      onChange={(e) => setEnquiryName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Phone *</label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. 9876543210"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={enquiryPhone}
                      onChange={(e) => setEnquiryPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Unit (optional)</label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={enquiryRoomId}
                      onChange={(e) => setEnquiryRoomId(e.target.value)}
                    >
                      <option value="">Any / General</option>
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.unit_code}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Date *</label>
                    <input
                      type="date"
                      required
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={enquiryDate}
                      onChange={(e) => setEnquiryDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Notes (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Wants 2BHK for weekend, budget ₹5000"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={enquiryNotes}
                    onChange={(e) => setEnquiryNotes(e.target.value)}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={resetEnquiryForm}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createEnquiry.isPending}>
                    {createEnquiry.isPending ? 'Saving...' : 'Save Enquiry'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function KpiRow({
  icon,
  label,
  value,
  sub,
  valueClassName,
}: {
  icon: React.ReactNode
  label: string
  value: string | null
  sub: string
  valueClassName?: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        {value === null ? (
          <Skeleton className="h-5 w-12 mt-0.5" />
        ) : (
          <p className={`text-sm font-bold ${valueClassName ?? ''}`}>{value}</p>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground hidden sm:block">{sub}</p>
    </div>
  )
}
