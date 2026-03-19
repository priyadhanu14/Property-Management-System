import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/api/client'
import type { BookingResponse } from '@/types/rooms'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  IndianRupee,
  Plus,
  X,
  TrendingUp,
  TrendingDown,
  Wallet,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UnitExpenseDetail {
  category: string
  amount: number
}

interface UnitSummary {
  room_id: number
  unit_code: string
  room_type: string
  revenue: number
  expenses: UnitExpenseDetail[]
  total_expenses: number
  net: number
}

interface PropertyExpense {
  id: number
  category: string
  amount: number
  description: string | null
}

interface MonthlyTotals {
  total_revenue: number
  total_expenses: number
  net: number
}

interface MonthlySummaryResponse {
  month: string
  units: UnitSummary[]
  property_wide_expenses: PropertyExpense[]
  totals: MonthlyTotals
}

interface ExpenseOut {
  id: number
  room_id: number | null
  category: string
  amount: number
  month: string
  description: string | null
  created_at: string | null
}

interface RoomOption {
  id: number
  unit_code: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CATEGORIES = [
  'electricity',
  'wifi',
  'cleaning',
  'maintenance',
  'water',
  'staff_salary',
  'other',
]

const CATEGORY_LABELS: Record<string, string> = {
  electricity: 'Electricity',
  wifi: 'WiFi',
  cleaning: 'Cleaning',
  maintenance: 'Maintenance',
  water: 'Water',
  staff_salary: 'Staff Salary',
  other: 'Other',
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n)
}

function getCurrentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1).toLocaleString('en-IN', {
    month: 'long',
    year: 'numeric',
  })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Accounts() {
  const queryClient = useQueryClient()
  const [month, setMonth] = useState(getCurrentMonth)
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [formRoomId, setFormRoomId] = useState<string>('')
  const [formCategory, setFormCategory] = useState(CATEGORIES[0])
  const [formAmount, setFormAmount] = useState('')
  const [formDate, setFormDate] = useState('')
  const [formDesc, setFormDesc] = useState('')

  // ---- Queries ----

  const summaryQuery = useQuery({
    queryKey: ['monthly-summary', month],
    queryFn: () =>
      api.get<MonthlySummaryResponse>(`/accounts/monthly-summary?month=${month}`),
  })

  const roomsQuery = useQuery({
    queryKey: ['rooms-list'],
    queryFn: () => api.get<RoomOption[]>('/rooms'),
    staleTime: 5 * 60 * 1000,
  })

  const rooms = roomsQuery.data ?? []

  const fromDate = `${month}-01`
  const toDate = (() => {
    const [y, m] = month.split('-').map(Number)
    return `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
  })()

  const bookingsQuery = useQuery({
    queryKey: ['accounts-bookings', month],
    queryFn: () =>
      api.get<BookingResponse[]>(`/bookings?from_date=${fromDate}&to_date=${toDate}&limit=500`),
  })

  const customerRows = useMemo(() => {
    const map = new Map<number, { guestName: string; rooms: string[]; startDate: string; totalPaid: number; balance: number }>()
    for (const b of bookingsQuery.data ?? []) {
      if (b.status === 'cancelled') continue
      const row = map.get(b.group_id)
      if (row) {
        row.rooms.push(b.unit_code)
      } else {
        map.set(b.group_id, {
          guestName: b.guest_name,
          rooms: [b.unit_code],
          startDate: b.start_datetime,
          totalPaid: b.total_paid,
          balance: b.balance,
        })
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    )
  }, [bookingsQuery.data])

  // ---- Mutations ----

  const createExpense = useMutation({
    mutationFn: (body: {
      room_id: number | null
      category: string
      amount: number
      month: string
      description: string | null
    }) => api.post<ExpenseOut>('/accounts/expenses', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-summary', month] })
      resetForm()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteExpense = useMutation({
    mutationFn: (id: number) => api.delete<void>(`/accounts/expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-summary', month] })
      toast.success('Expense deleted')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  function resetForm() {
    setFormRoomId('')
    setFormCategory(CATEGORIES[0])
    setFormAmount('')
    setFormDate('')
    setFormDesc('')
    setShowForm(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Use picked date or fall back to first of current month
    const expenseMonth = formDate || `${month}-01`
    createExpense.mutate({
      room_id: formRoomId ? Number(formRoomId) : null,
      category: formCategory,
      amount: Number(formAmount),
      month: expenseMonth,
      description: formDesc || null,
    })
  }

  const summary = summaryQuery.data

  return (
    <div className="space-y-6">
      {/* ---- Header + month picker ---- */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Accounts</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-[140px] text-center font-medium">
            {monthLabel(month)}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* ---- Totals cards ---- */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <TrendingUp className="size-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-emerald-500">
                {formatCurrency(summary.totals.total_revenue)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
              <TrendingDown className="size-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-500">
                {formatCurrency(summary.totals.total_expenses)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
              <Wallet className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p
                className={cn(
                  'text-2xl font-bold',
                  summary.totals.net >= 0 ? 'text-emerald-500' : 'text-red-500'
                )}
              >
                {formatCurrency(summary.totals.net)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ---- Customer-wise revenue ---- */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <IndianRupee className="size-5" />
            Revenue by Customer
          </CardTitle>
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="size-4" />
            Add Expense
          </Button>
        </CardHeader>
        <CardContent>
          {bookingsQuery.isLoading && (
            <p className="text-muted-foreground">Loading...</p>
          )}
          {!bookingsQuery.isLoading && customerRows.length === 0 && (
            <p className="text-muted-foreground">No bookings this month.</p>
          )}
          {customerRows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-3 pr-4 font-medium">Guest Name</th>
                    <th className="py-3 pr-4 font-medium text-center">Rooms</th>
                    <th className="py-3 pr-4 font-medium">Check-in Date</th>
                    <th className="py-3 pr-4 font-medium text-right">Amount Paid</th>
                    <th className="py-3 font-medium text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {customerRows.map((row, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-3 pr-4 font-medium">{row.guestName}</td>
                      <td className="py-3 pr-4 text-center text-muted-foreground">
                        <span title={row.rooms.join(', ')}>{row.rooms.length}</span>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {formatDate(row.startDate)}
                      </td>
                      <td className="py-3 pr-4 text-right text-emerald-500 font-medium">
                        {formatCurrency(row.totalPaid)}
                      </td>
                      <td className={cn(
                        'py-3 text-right font-medium',
                        row.balance > 0 ? 'text-red-500' : 'text-muted-foreground'
                      )}>
                        {row.balance > 0 ? formatCurrency(row.balance) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---- Property-wide expenses ---- */}
      {summary && summary.property_wide_expenses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Property-wide Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {summary.property_wide_expenses.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <div>
                    <span className="font-medium">{CATEGORY_LABELS[e.category] ?? e.category}</span>
                    {e.description && (
                      <span className="ml-2 text-muted-foreground">
                        — {e.description}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-red-500">
                      {formatCurrency(e.amount)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => deleteExpense.mutate(e.id)}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* ---- Add expense modal/overlay ---- */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={resetForm}>
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Add Expense</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={resetForm}
              >
                <X className="size-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Room */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    Unit (leave empty for property-wide)
                  </label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={formRoomId}
                    onChange={(e) => setFormRoomId(e.target.value)}
                  >
                    <option value="">Property-wide</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.unit_code}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Category */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Category</label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_LABELS[c] ?? c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Amount + Date */}
                <div className="grid gap-4 grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Amount (INR) *</label>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      required
                      placeholder="e.g. 3200"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Date *</label>
                    <input
                      type="date"
                      required
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    Description (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. EB bill for Jan"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createExpense.isPending}>
                    {createExpense.isPending ? 'Saving...' : 'Save'}
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
