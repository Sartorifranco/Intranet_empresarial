import { auth } from './firebase'
import type { AuditAction, AuditTargetType } from './auditLogService'

export interface AuditLogDto {
  id: string
  userId: string
  userEmail: string
  action: AuditAction | string
  targetType: AuditTargetType | string
  targetId: string
  targetName: string
  parentFolderId: string | null
  mimeType: string | null
  reason: string | null
  metadata: Record<string, unknown>
  createdAt: string | null
}

export type AuditFilterBy = 'userId' | 'targetId' | 'action'

export interface FetchAuditLogsInput {
  filterBy?: AuditFilterBy
  value?: string
  startDate?: string
  endDate?: string
  pageSize?: number
  pageToken?: string | null
}

export interface FetchAuditLogsResult {
  logs: AuditLogDto[]
  nextPageToken: string | null
}

export async function fetchAuditLogs(input: FetchAuditLogsInput = {}): Promise<FetchAuditLogsResult> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) {
    throw new Error('No autenticado')
  }

  const params = new URLSearchParams()
  if (input.filterBy && input.value) {
    params.set('filterBy', input.filterBy)
    params.set('value', input.value)
  }
  if (input.startDate) params.set('startDate', input.startDate)
  if (input.endDate) params.set('endDate', input.endDate)
  if (input.pageSize) params.set('pageSize', String(input.pageSize))
  if (input.pageToken) params.set('pageToken', input.pageToken)

  const qs = params.toString()
  const res = await fetch(`/api/audit/logs${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  const body = (await res.json().catch(() => ({}))) as {
    error?: string
    logs?: AuditLogDto[]
    nextPageToken?: string | null
  }

  if (!res.ok) {
    throw new Error(body.error ?? `Error ${res.status}`)
  }

  return {
    logs: body.logs ?? [],
    nextPageToken: body.nextPageToken ?? null,
  }
}
