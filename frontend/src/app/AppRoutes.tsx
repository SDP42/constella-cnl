import { Navigate, Route, Routes } from 'react-router-dom'
import { homeFor, useAuth } from '@/lib/auth'

export default function AppRoutes() {
  const user = useAuth((s) => s.user)
  if (!user) return <Navigate to="/#seats" replace />
  return (
    <Routes>
      <Route index element={<Navigate to={homeFor(user.role)} replace />} />
      <Route path="*" element={<div className="grid min-h-dvh place-items-center display text-4xl">Workspace — building</div>} />
    </Routes>
  )
}
