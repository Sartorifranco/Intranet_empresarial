import { loadAccessibleInventory } from './accessibleDriveInventory.js'
import type { RagToolContext } from './executeRagTool.js'

export async function listAccessibleFoldersTool(ctx: RagToolContext): Promise<Record<string, unknown>> {
  const inventory = await loadAccessibleInventory({
    drive: ctx.drive,
    config: ctx.config,
    searchSubject: ctx.searchSubject,
  })

  return {
    areaLabel: inventory.areaLabel,
    totalFolders: inventory.folders.length,
    foldersVisited: inventory.foldersVisited,
    folders: inventory.folders.map((folder) => ({
      name: folder.name,
      directFileCount: folder.directFileCount,
      parentFolderName:
        inventory.folders.find((candidate) => candidate.id === folder.parentFolderId)?.name ??
        null,
    })),
    note:
      'Usá list_folder_contents con el nombre de la carpeta para ver archivos. Para resúmenes, llamá summarize_document por cada archivo.',
  }
}
