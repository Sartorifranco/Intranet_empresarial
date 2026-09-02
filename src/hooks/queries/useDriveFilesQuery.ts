import { useQuery } from '@tanstack/react-query'
import { listDriveFiles, type ListDriveFilesResult } from '../../services/driveApi'
import { DRIVE_STALE_MS, queryClient } from '../../lib/queryClient'
import { queryKeys } from '../../lib/queryKeys'

export function useDriveFilesQuery(
  uid: string | undefined,
  folderId: string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.drive.files(uid, folderId),
    queryFn: () => listDriveFiles(folderId),
    enabled: Boolean(uid) && enabled,
    staleTime: DRIVE_STALE_MS,
  })
}

export async function invalidateDriveFolderListing(
  uid: string | undefined,
  folderId: string | null,
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: queryKeys.drive.files(uid, folderId),
    refetchType: 'active',
  })
}

export async function invalidateAllDriveListings(uid: string | undefined): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: ['drive', 'files', uid ?? 'anon'],
    refetchType: 'active',
  })
}

export type { ListDriveFilesResult }
