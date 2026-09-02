import { getDrive } from '../../lib/google/driveClient.js'
import { getSharedDriveRootId } from '../../lib/google/sharedDrive.js'
import { adminDb } from '../../lib/firebase/admin.js'
import { logError } from '../../lib/log.js'

const MAPPING_COLLECTION = 'driveFolderAreas'
const MAX_DEPTH = 40

/**
 * Camina padres de Drive hasta el hijo directo de DRIVE_ID y lee driveFolderAreas.
 * Sin mapeo o raíz → null (solo super_admin aprueba).
 */
export async function resolveGoverningAreaId(
  folderId: string,
): Promise<string | null> {
  const driveId = getSharedDriveRootId()
  if (!folderId || folderId === driveId) return null

  try {
    const drive = await getDrive()
    let current = folderId

    for (let i = 0; i < MAX_DEPTH; i++) {
      const meta = await drive.files.get({
        fileId: current,
        supportsAllDrives: true,
        fields: 'id, parents, driveId, mimeType',
      })

      const parent = meta.data.parents?.[0]
      if (!parent || parent === driveId) {
        const snap = await adminDb().collection(MAPPING_COLLECTION).doc(current).get()
        const raw = snap.exists ? snap.get('governingAreaId') : null
        return typeof raw === 'string' && raw.length > 0 ? raw : null
      }
      current = parent
    }

    return null
  } catch (err) {
    logError('resolveGoverningAreaId falló', err)
    return null
  }
}

export async function getStoredGoverningAreaId(fileId: string): Promise<string | null | undefined> {
  const snap = await adminDb().collection('driveFiles').doc(fileId).get()
  if (!snap.exists) return undefined
  const raw = snap.get('governingAreaId')
  if (raw === null) return null
  if (typeof raw === 'string' && raw.length > 0) return raw
  return undefined
}
