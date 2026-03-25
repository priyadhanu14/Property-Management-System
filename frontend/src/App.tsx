import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Layout } from '@/components/layout/Layout'
import { Dashboard } from '@/pages/Dashboard'
import { Rooms } from '@/pages/Rooms'
import { Bookings } from '@/pages/Bookings'
import { Accounts } from '@/pages/Accounts'
import { Login } from '@/pages/Login'
import { useAuth } from '@/components/AuthProvider'

function App() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!session) {
    return (
      <>
        <Login />
        <Toaster />
      </>
    )
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="rooms" element={<Rooms />} />
          <Route path="bookings" element={<Bookings />} />
          <Route path="accounts" element={<Accounts />} />
        </Route>
      </Routes>
      <Toaster />
    </>
  )
}

export default App