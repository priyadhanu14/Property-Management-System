import { Outlet, NavLink } from 'react-router-dom'
import { LayoutDashboard, Building2, CalendarDays, IndianRupee, Sun, Moon, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/components/ThemeProvider'
import { useAuth } from '@/components/AuthProvider'
import { Button } from '@/components/ui/button'

const nav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/rooms', label: 'Rooms', icon: Building2 },
  { to: '/bookings', label: 'Bookings', icon: CalendarDays },
  { to: '/accounts', label: 'Accounts', icon: IndianRupee },
]

export function Layout() {
  const { theme, toggleTheme } = useTheme()
  const { signOut } = useAuth()

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container flex h-14 items-center gap-2 px-4">
          <span className="font-semibold mr-2 shrink-0">Bahuleya PMS</span>
          <nav className="flex flex-1 items-center gap-1">
            {nav.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'text-primary bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  )
                }
              >
                <Icon className="size-4 shrink-0" />
                <span className="hidden sm:inline">{label}</span>
              </NavLink>
            ))}
          </nav>
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme" className="shrink-0">
            {theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out" className="shrink-0">
            <LogOut className="size-5" />
          </Button>
        </div>
      </header>
      <main className="flex-1 overflow-auto p-4">
        <Outlet />
      </main>
    </div>
  )
}