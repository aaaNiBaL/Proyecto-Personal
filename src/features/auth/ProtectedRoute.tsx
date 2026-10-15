import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function ProtectedRoute() {
  const { configured, loading, user } = useAuth()
  const location = useLocation()

  if (loading) {
    return <main className="page-shell"><p role="status">Comprobando sesión…</p></main>
  }

  if (!configured || !user) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`)
    return <Navigate to={`/cuenta?redirect=${redirect}`} replace />
  }

  return <Outlet />
}
