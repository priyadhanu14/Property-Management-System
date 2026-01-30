import { Outlet, NavLink } from 'react-router-dom'
import { LayoutDashboard, Building2, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'

const nav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/rooms', label: 'Rooms', icon: Building2 },
  { to: '/bookings', label: 'Bookings', icon: CalendarDays },
]

export function Layout() {
  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container flex h-14 items-center px-4">
          <span className="font-semibold">Bahuleya PMS</span>
        </div>
      </header>
      <main className="flex-1 overflow-auto p-4 pb-24 md:pb-4">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 z-10 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 md:relative md:border-t-0">
        <div className="flex justify-around md:container md:justify-start md:gap-1 md:px-4 md:py-2">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 px-4 py-3 text-sm font-medium transition-colors md:flex-row md:rounded-md md:px-3 md:py-2',
                  isActive
                    ? 'text-primary bg-primary/10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )
              }
            >
              <Icon className="size-5" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
