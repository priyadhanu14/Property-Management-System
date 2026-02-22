import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
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
} from 'lucide-react'
import type { DashboardData } from '@/types/rooms'
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

export function Dashboard() {
  const navigate = useNavigate()

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['dashboard-today'],
    queryFn: () => api.get<DashboardData>('/dashboard/today'),
    refetchInterval: 60_000,
  })

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
            <BookingCalendar />
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
