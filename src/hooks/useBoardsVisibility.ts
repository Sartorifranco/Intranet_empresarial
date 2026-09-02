import { useEffect, useState } from 'react'
import { useAuth } from '../context'
import { fetchBoardsVisibility } from '../services/boardsApi'
import { isSuperAdmin } from '../services/userService'

export function useBoardsVisibility(): boolean | null {
  const { user, userProfile, loading } = useAuth()
  const [visible, setVisible] = useState<boolean | null>(null)

  useEffect(() => {
    if (loading) return
    if (!user) {
      setVisible(false)
      return
    }
    if (isSuperAdmin(userProfile)) {
      setVisible(true)
      return
    }

    let cancelled = false
    fetchBoardsVisibility()
      .then((result) => {
        if (!cancelled) setVisible(result.visible)
      })
      .catch(() => {
        if (!cancelled) setVisible(false)
      })

    return () => {
      cancelled = true
    }
  }, [user, userProfile, loading])

  return visible
}
