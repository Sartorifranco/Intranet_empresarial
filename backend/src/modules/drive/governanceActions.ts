import type { AuthedUser } from '../auth/middleware.js'
import { isSuperAdminUser } from '../auth/middleware.js'

/** Acciones de gobernanza intranet sobre archivos Drive (grantables por área). */
export type GovernanceAction =
  | 'approval'
  | 'permission_grant'
  | 'classification_change'
  | 'authorized_copy'

export const GOVERNANCE_ACTIONS: readonly GovernanceAction[] = [
  'approval',
  'permission_grant',
  'classification_change',
  'authorized_copy',
]

export type ActionGrants = Partial<Record<GovernanceAction, string[]>>

export function isGovernanceAction(value: unknown): value is GovernanceAction {
  return typeof value === 'string' && (GOVERNANCE_ACTIONS as readonly string[]).includes(value)
}

export function normalizeStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const trimmed = item.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(trimmed)
  }
  return out
}

/** Normaliza actionGrants desde Firestore (sin validar existencia de áreas). */
export function normalizeActionGrants(raw: unknown): ActionGrants {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const source = raw as Record<string, unknown>
  const out: ActionGrants = {}
  for (const action of GOVERNANCE_ACTIONS) {
    const ids = normalizeStringArray(source[action])
    if (ids.length > 0) out[action] = ids
  }
  return out
}

/**
 * super_admin, jefe del área gobernante, o grant puntual para la acción.
 * Sin governingAreaId → solo super_admin.
 */
export function canPerformGovernanceAction(
  user: AuthedUser,
  action: GovernanceAction,
  governingAreaId: string | null,
): boolean {
  if (isSuperAdminUser(user)) return true
  if (!governingAreaId) return false
  if (user.managedAreaIds.includes(governingAreaId)) return true
  const grants = user.actionGrants[action] ?? []
  return grants.includes(governingAreaId)
}
