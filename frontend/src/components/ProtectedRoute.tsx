import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function ProtectedRoute() {
  const { isAuthenticated, logout } = useAuth()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return (
    <div>
      <header>
        <button onClick={() => logout()}>Log out</button>
      </header>
      <Outlet />
    </div>
  )
}
