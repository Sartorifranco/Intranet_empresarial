import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context'
import { isSuperAdmin } from '../services/userService'

export function SuperAdminRoute() {
  const { user, userProfile, loading, profileLoading } = useAuth()

  if (loading || profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <div className="spinner-brand h-8 w-8 animate-spin rounded-full border-4" />
          <p className="text-sm text-neutral-500 dark:text-gray-400">Verificando permisos...</p>
        </div>
      </div>
    )
  }

  if (!user || !isSuperAdmin(userProfile)) {
    return <Navigate to="/intranet" replace />
  }

  return <Outlet />
}
