import { Timestamp } from 'firebase/firestore'

export function toContentDate(value: Timestamp | Date): Date {
  return value instanceof Timestamp ? value.toDate() : value
}

export function isContentExpired(expiresAt?: Timestamp | Date | null): boolean {
  if (!expiresAt) return false
  return toContentDate(expiresAt).getTime() <= Date.now()
}

export function timestampToDatetimeLocal(value?: Timestamp | Date | null): string {
  if (!value) return ''

  const date = toContentDate(value)
  const pad = (n: number) => String(n).padStart(2, '0')

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function datetimeLocalToTimestamp(value: string): Timestamp | null {
  if (!value.trim()) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return Timestamp.fromDate(date)
}

export function formatExpiryLabel(expiresAt?: Timestamp | Date | null): string | null {
  if (!expiresAt) return null

  const date = toContentDate(expiresAt)
  const expired = isContentExpired(expiresAt)

  const formatted = date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return expired ? `Venció ${formatted}` : `Vence ${formatted}`
}
