import type { AuthedUser } from '../auth/middleware.js'
import { getStoredGoverningAreaId, resolveGoverningAreaId } from './resolveGoverningArea.js'

/** super_admin o jefe con el área gobernante del archivo/carpeta en managedAreaIds. */
export function canGovernDriveFile(user: AuthedUser, governingAreaId: string | null): boolean {
  if (user.role === 'super_admin') return true
  if (!governingAreaId) return false
  return user.managedAreaIds.includes(governingAreaId)
}

export async function resolveFileGoverningAreaId(
  fileId: string,
  parentFolderId?: string | null,
): Promise<string | null> {
  let governingAreaId = await getStoredGoverningAreaId(fileId)
  if (governingAreaId === undefined && parentFolderId) {
    governingAreaId = await resolveGoverningAreaId(parentFolderId)
  }
  return governingAreaId ?? null
}

export const GOVERN_DRIVE_FORBIDDEN =
  'No tenés permiso para gestionar este archivo en su área gobernante'
