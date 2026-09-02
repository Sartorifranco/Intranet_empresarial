import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context'
import { useBoardsVisibility } from '../hooks/useBoardsVisibility'

export function BoardsRoute() {
  const { user, loading } = useAuth()
  const boardsVisible = useBoardsVisibility()

  if (loading || boardsVisible === null) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="spinner-brand h-8 w-8 animate-spin rounded-full border-4" />
          <p className="text-sm text-neutral-500 dark:text-gray-400">Verificando permisos…</p>
        </div>
      </div>
    )
  }

  if (!user || !boardsVisible) {
    return <Navigate to="/intranet" replace />
  }

  return <Outlet />
}
