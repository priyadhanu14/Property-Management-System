import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Layout } from '@/components/layout/Layout'
import { Dashboard } from '@/pages/Dashboard'
import { Rooms } from '@/pages/Rooms'
import { Bookings } from '@/pages/Bookings'

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="rooms" element={<Rooms />} />
          <Route path="bookings" element={<Bookings />} />
        </Route>
      </Routes>
      <Toaster />
    </>
  )
}

export default App
