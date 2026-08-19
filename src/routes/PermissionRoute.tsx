import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context'
import type { UserPermissions } from '../services/userService'

interface PermissionRouteProps {
  permission: keyof UserPermissions
  redirectTo?: string
}

export function PermissionRoute({ permission, redirectTo = '/intranet' }: PermissionRouteProps) {
  const { userProfile, profileLoading } = useAuth()

  if (profileLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="spinner-brand h-8 w-8 animate-spin rounded-full border-4" />
          <p className="text-sm text-neutral-500 dark:text-gray-400">Verificando permisos...</p>
        </div>
      </div>
    )
  }

  if (!userProfile?.permissions[permission]) {
    return <Navigate to={redirectTo} replace />
  }

  return <Outlet />
}
