import {
  findAccessibleFolder,
  loadAccessibleInventory,
} from './accessibleDriveInventory.js'
import type { RagToolContext } from './executeRagTool.js'

const DEFAULT_LIMIT = 100

export async function listFolderContentsTool(
  ctx: RagToolContext,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const folderName =
    typeof args.folderName === 'string' ? args.folderName.trim() : ''
  if (!folderName) {
    return {
      error: 'FOLDER_NAME_REQUIRED',
      message: 'Indicá folderName (nombre completo o parcial de la carpeta).',
    }
  }

  const inventory = await loadAccessibleInventory({
    drive: ctx.drive,
    config: ctx.config,
    searchSubject: ctx.searchSubject,
  })

  const folder = findAccessibleFolder(inventory, folderName)
  if (!folder) {
    const matches = inventory.folders
      .filter((item) => item.name.toLowerCase().includes(folderName.toLowerCase()))
      .map((item) => item.name)
    return {
      error: 'FOLDER_NOT_FOUND',
      message:
        matches.length > 1
          ? `Hay varias carpetas que coinciden: ${matches.join(', ')}. Pedí una en particular.`
          : `No encontré la carpeta "${folderName}".`,
      suggestions: matches.slice(0, 10),
    }
  }

  const limitRaw = typeof args.limit === 'number' ? args.limit : DEFAULT_LIMIT
  const limit = Math.min(200, Math.max(1, Math.floor(limitRaw)))

  const files = inventory.files
    .filter((file) => file.parentFolderId === folder.id)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    .slice(0, limit)
    .map((file) => ({
      fileName: file.name,
      fileKind: file.fileKind,
      modifiedTime: file.modifiedTime,
      webViewLink: file.webViewLink,
    }))

  return {
    areaLabel: inventory.areaLabel,
    folderName: folder.name,
    totalFilesInFolder: inventory.files.filter((file) => file.parentFolderId === folder.id)
      .length,
    files,
    truncated: files.length < inventory.files.filter((file) => file.parentFolderId === folder.id).length,
    note: 'Para resumir un archivo, usá summarize_document con fileName.',
  }
}
