import type { drive_v3 } from 'googleapis'

export const PERMISSION_ROLES = ['reader', 'writer', 'commenter'] as const
export type PermissionRole = (typeof PERMISSION_ROLES)[number]

/** En Shared Drives, writer no puede enviar a papelera. La escritura de la API es fileOrganizer. */
export function toDriveRole(role: PermissionRole): 'reader' | 'commenter' | 'fileOrganizer' {
  return role === 'writer' ? 'fileOrganizer' : role
}

export function isPermissionRole(value: unknown): value is PermissionRole {
  return typeof value === 'string' && (PERMISSION_ROLES as readonly string[]).includes(value)
}

export async function findDirectUserPermission(
  drive: drive_v3.Drive,
  fileId: string,
  email: string,
) {
  let pageToken: string | undefined
  do {
    const listed = await drive.permissions.list({
      fileId,
      supportsAllDrives: true,
      fields: 'nextPageToken, permissions(id, type, role, emailAddress, domain)',
      pageSize: 100,
      pageToken,
    })
    const match = (listed.data.permissions ?? []).find(
      (permission) =>
        permission.type === 'user' &&
        permission.emailAddress?.trim().toLowerCase() === email,
    )
    if (match) return match
    pageToken = listed.data.nextPageToken ?? undefined
  } while (pageToken)
  return null
}

export async function grantUserDrivePermission(
  drive: drive_v3.Drive,
  fileId: string,
  email: string,
  role: PermissionRole,
  options?: { sendNotificationEmail?: boolean },
): Promise<{
  permissionId: string
  driveRole: 'reader' | 'commenter' | 'fileOrganizer'
  role: PermissionRole
  emailAddress: string
}> {
  const driveRole = toDriveRole(role)
  const normalizedEmail = email.trim().toLowerCase()

  const created = await drive.permissions
    .create({
      fileId,
      requestBody: {
        type: 'user',
        role: driveRole,
        emailAddress: normalizedEmail,
      },
      sendNotificationEmail: options?.sendNotificationEmail ?? true,
      supportsAllDrives: true,
      enforceExpansiveAccess: true,
      fields: 'id, type, role, emailAddress, domain',
    })
    .catch(async (err) => {
      const existing = await findDirectUserPermission(drive, fileId, normalizedEmail)
      if (!existing?.id) throw err
      if (existing.role === driveRole) {
        return { data: existing }
      }
      return drive.permissions.update({
        fileId,
        permissionId: existing.id,
        requestBody: { role: driveRole },
        supportsAllDrives: true,
        fields: 'id, type, role, emailAddress, domain',
      })
    })

  return {
    permissionId: created.data.id ?? '',
    driveRole,
    role,
    emailAddress: created.data.emailAddress?.trim().toLowerCase() ?? normalizedEmail,
  }
}
