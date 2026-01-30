import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CalendarDays } from 'lucide-react'

export function Bookings() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Bookings</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="size-5" />
            Booking management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Placeholder — create / edit / cancel bookings to be built.</p>
        </CardContent>
      </Card>
    </div>
  )
}
