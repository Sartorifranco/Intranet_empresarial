import { useAuth } from '../context'
import { useBoardsVisibilityQuery } from './queries/useCatalogQueries'
import { isSuperAdmin } from '../services/userService'

export function useBoardsVisibility(): boolean | null {
  const { user, userProfile, loading } = useAuth()
  const superAdmin = isSuperAdmin(userProfile)
  const { data, isPending, isError } = useBoardsVisibilityQuery(
    user?.uid,
    !loading && Boolean(user),
    superAdmin,
  )

  if (loading) return null
  if (!user) return false
  if (superAdmin) return true
  if (isPending) return null
  if (isError) return false
  return data?.visible ?? false
}
