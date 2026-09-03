import { getEnv } from '../../config/env.js'

/**
 * Parámetros fijos de la Unidad compartida. Nunca leer driveId/corpora
 * desde query ni body: el cliente no puede elegir otra unidad.
 */
export function getSharedDriveQuery() {
  const { driveId } = getEnv()
  return {
    supportsAllDrives: true as const,
    includeItemsFromAllDrives: true as const,
    corpora: 'drive' as const,
    driveId,
  }
}

export function getSharedDriveRootId(): string {
  return getEnv().driveId
}
