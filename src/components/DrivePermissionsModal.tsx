import { Loader2, Search, Share2, Trash2, UserPlus, Users, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import {
  grantDriveAreaPermission,
  grantDrivePermission,
  listDrivePermissions,
  revokeDrivePermission,
  type DriveAreaMemberDto,
  type DriveClassification,
  type DrivePermissionDto,
  type DrivePermissionRole,
} from '../services/driveApi'
import { getAllUsers, type UserProfile } from '../services/userService'

const ALLOWED_DOMAIN = 'bacarsa.com.ar'
const MIN_REASON_LENGTH = 15

const classificationLabel: Record<DriveClassification, string> = {
  RESTRINGIDO: 'Restringido',
  CONFIDENCIAL: 'Confidencial',
  USO_INTERNO: 'Uso interno',
}

const roleLabel: Record<'reader' | 'writer', string> = {
  reader: 'Lector',
  writer: 'Escritor',
}

function permissionRoleLabel(role: DrivePermissionRole): string {
  if (role === 'writer') return 'Escritor'
  if (role === 'commenter') return 'Comentarista'
  return 'Lector'
}

interface DrivePermissionsModalProps {
  fileId: string
  fileName: string
  classification: DriveClassification | null
  onClose: () => void
}

export function DrivePermissionsModal({
  fileId,
  fileName,
  classification,
  onClose,
}: DrivePermissionsModalProps) {
  const effectiveClassification = classification ?? 'USO_INTERNO'
  const isRestricted = effectiveClassification === 'RESTRINGIDO'

  const [permissions, setPermissions] = useState<DrivePermissionDto[]>([])
  const [domainAccess, setDomainAccess] = useState<
    Awaited<ReturnType<typeof listDrivePermissions>>['domainAccess']
  >(null)
  const [governingAreaId, setGoverningAreaId] = useState<string | null>(null)
  const [governingAreaName, setGoverningAreaName] = useState<string | null>(null)
  const [areaMembers, setAreaMembers] = useState<DriveAreaMemberDto[]>([])
  const [allUsers, setAllUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selectedEmail, setSelectedEmail] = useState('')
  const [grantRole, setGrantRole] = useState<'reader' | 'writer'>('reader')
  const [grantReason, setGrantReason] = useState('')
  const [areaGrantRole, setAreaGrantRole] = useState<'reader' | 'writer'>('reader')
  const [areaGrantReason, setAreaGrantReason] = useState('')
  const [revokeTarget, setRevokeTarget] = useState<DrivePermissionDto | null>(null)
  const [revokeReason, setRevokeReason] = useState('')
  const [acting, setActing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [access, users] = await Promise.all([listDrivePermissions(fileId), getAllUsers()])
      setPermissions(access.permissions)
      setDomainAccess(access.domainAccess)
      setGoverningAreaId(access.governingAreaId)
      setGoverningAreaName(access.governingAreaName)
      setAreaMembers(access.areaMembers)
      setAllUsers(users)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo cargar los permisos')
    } finally {
      setLoading(false)
    }
  }, [fileId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const grantedEmails = useMemo(
    () => new Set(permissions.map((row) => row.emailAddress)),
    [permissions],
  )

  const candidates = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es')
    const typedEmail =
      normalized.includes('@') && normalized.endsWith(`@${ALLOWED_DOMAIN}`) ? normalized : null

    const fromDirectory = allUsers
      .filter((user) => !grantedEmails.has(user.email.trim().toLowerCase()))
      .filter((user) => {
        if (!normalized) return true
        const haystack = `${user.displayName ?? ''} ${user.email}`.toLocaleLowerCase('es')
        return haystack.includes(normalized)
      })
      .slice(0, 8)

    if (
      typedEmail &&
      !grantedEmails.has(typedEmail) &&
      !fromDirectory.some((user) => user.email.toLowerCase() === typedEmail)
    ) {
      return [{ uid: typedEmail, email: typedEmail, displayName: typedEmail } as UserProfile, ...fromDirectory]
    }

    return fromDirectory
  }, [allUsers, grantedEmails, query])

  const handleAreaGrant = async (event: FormEvent) => {
    event.preventDefault()
    if (!governingAreaId || areaGrantReason.trim().length < MIN_REASON_LENGTH) return

    setActing(true)
    try {
      const result = await grantDriveAreaPermission(fileId, {
        role: areaGrantRole,
        reason: areaGrantReason.trim(),
      })
      const partial = result.failedCount > 0
      toast.success(
        partial
          ? `Permiso otorgado a ${result.grantedCount} personas (${result.failedCount} fallos)`
          : `Permiso otorgado a ${result.grantedCount} personas de ${result.areaName}`,
      )
      setAreaGrantReason('')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo compartir con el área')
    } finally {
      setActing(false)
    }
  }

  const handleGrant = async (event: FormEvent) => {
    event.preventDefault()
    const email = selectedEmail.trim().toLowerCase()
    if (!email || !grantReason.trim()) return
    if (grantReason.trim().length < MIN_REASON_LENGTH) {
      toast.error(`El motivo debe tener al menos ${MIN_REASON_LENGTH} caracteres`)
      return
    }
    if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      toast.error(`Solo se permiten emails @${ALLOWED_DOMAIN}`)
      return
    }

    setActing(true)
    try {
      await grantDrivePermission(fileId, {
        email,
        role: grantRole,
        reason: grantReason.trim(),
      })
      toast.success('Permiso otorgado')
      setSelectedEmail('')
      setGrantReason('')
      setQuery('')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo otorgar el permiso')
    } finally {
      setActing(false)
    }
  }

  const handleRevoke = async (event: FormEvent) => {
    event.preventDefault()
    if (!revokeTarget || !revokeReason.trim()) return
    if (revokeReason.trim().length < MIN_REASON_LENGTH) {
      toast.error(`El motivo debe tener al menos ${MIN_REASON_LENGTH} caracteres`)
      return
    }

    setActing(true)
    try {
      await revokeDrivePermission(fileId, revokeTarget.id, revokeReason.trim())
      toast.success('Permiso revocado')
      setRevokeTarget(null)
      setRevokeReason('')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo revocar el permiso')
    } finally {
      setActing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-neutral-900/50"
        onClick={onClose}
      />

      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        <header className="flex items-start justify-between border-b border-neutral-200 px-5 py-4 dark:border-zinc-800">
          <div>
            <div className="mb-2 flex items-center gap-2 text-brand-primary">
              <Share2 className="h-4 w-4" />
              <p className="text-xs font-semibold uppercase tracking-wide">Permisos de Drive</p>
            </div>
            <h2 className="text-lg font-semibold">{fileName}</h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-zinc-400">
              Clasificación: {classificationLabel[effectiveClassification]}
              {isRestricted ? ' · solo personas puntuales' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-zinc-800"
            aria-label="Cerrar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <section>
            <h3 className="mb-2 text-sm font-medium">Personas con acceso</h3>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
              </div>
            ) : permissions.length === 0 ? (
              <p className="rounded-lg border border-dashed border-neutral-200 px-4 py-6 text-center text-sm text-neutral-500 dark:border-zinc-700 dark:text-zinc-400">
                Nadie tiene acceso directo todavía.
              </p>
            ) : (
              <ul className="space-y-2">
                {permissions.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-2.5 dark:border-zinc-800"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {row.displayName || row.emailAddress}
                      </p>
                      <p className="truncate text-xs text-neutral-500 dark:text-zinc-400">
                        {row.emailAddress} · {permissionRoleLabel(row.role)}
                        {row.inherited ? ' · heredado' : ''}
                      </p>
                    </div>
                    {row.inherited ? (
                      <span className="shrink-0 text-xs text-neutral-400 dark:text-zinc-500">
                        No revocable
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRevokeTarget(row)}
                        className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-danger hover:bg-brand-tint dark:hover:bg-brand-primary-hover/30"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Quitar
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {!loading && domainAccess && !isRestricted && (
              <p className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
                Acceso de dominio @{domainAccess.domain} ({permissionRoleLabel(domainAccess.role)})
                {domainAccess.inherited ? ', heredado' : ''}. Revocalo desde Google Drive si
                corresponde.
              </p>
            )}
          </section>

          {governingAreaId && governingAreaName && (
            <section>
              <h3 className="mb-2 text-sm font-medium">Compartir con todo el área</h3>
              <p className="mb-3 text-xs text-neutral-500 dark:text-zinc-400">
                Otorga acceso individual en Drive a{' '}
                <span className="font-medium text-neutral-700 dark:text-zinc-200">
                  {areaMembers.length} persona{areaMembers.length === 1 ? '' : 's'}
                </span>{' '}
                de {governingAreaName} (miembros + jefes del área).
              </p>
              {areaMembers.length === 0 ? (
                <p className="rounded-lg border border-dashed border-neutral-200 px-4 py-4 text-sm text-neutral-500 dark:border-zinc-700 dark:text-zinc-400">
                  No hay usuarios con pertenencia a {governingAreaName}. Asignalos en Usuarios →
                  editar perfil → Áreas de pertenencia.
                </p>
              ) : (
                <form onSubmit={handleAreaGrant} className="space-y-3 rounded-lg border border-neutral-200 bg-neutral-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                  <ul className="max-h-28 space-y-1 overflow-y-auto text-xs text-neutral-600 dark:text-zinc-400">
                    {areaMembers.map((member) => (
                      <li key={member.uid} className="truncate">
                        {member.displayName || member.email} · {member.email}
                      </li>
                    ))}
                  </ul>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-neutral-500 dark:text-zinc-400">
                      Rol
                    </span>
                    <select
                      value={areaGrantRole}
                      onChange={(event) =>
                        setAreaGrantRole(event.target.value as 'reader' | 'writer')
                      }
                      className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none input-brand-focus dark:border-zinc-700 dark:bg-zinc-950"
                    >
                      <option value="reader">{roleLabel.reader}</option>
                      <option value="writer">{roleLabel.writer}</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-neutral-500 dark:text-zinc-400">
                      Motivo (mín. {MIN_REASON_LENGTH} caracteres)
                    </span>
                    <textarea
                      required
                      rows={2}
                      value={areaGrantReason}
                      onChange={(event) => setAreaGrantReason(event.target.value)}
                      className="w-full resize-none rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none input-brand-focus dark:border-zinc-700 dark:bg-zinc-950"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={
                      acting || areaGrantReason.trim().length < MIN_REASON_LENGTH
                    }
                    className="btn-primary inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Users className="h-4 w-4" />
                    {acting
                      ? 'Compartiendo…'
                      : `Compartir con ${governingAreaName}`}
                  </button>
                </form>
              )}
            </section>
          )}

          <section>
            <h3 className="mb-2 text-sm font-medium">Otorgar acceso a una persona</h3>
            {isRestricted && (
              <p className="mb-3 rounded-lg alert-error px-3 py-2 text-xs text-danger">
                Archivo restringido: solo podés compartir con personas puntuales de @
                {ALLOWED_DOMAIN}. No hay link abierto ni acceso por dominio.
              </p>
            )}

            <form onSubmit={handleGrant} className="space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-neutral-500 dark:text-zinc-400">
                  Buscar por nombre o email
                </span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <input
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value)
                      setSelectedEmail('')
                    }}
                    placeholder={`nombre o usuario@${ALLOWED_DOMAIN}`}
                    className="h-10 w-full rounded-lg border border-neutral-300 bg-white pl-9 pr-3 text-sm outline-none input-brand-focus dark:border-zinc-700 dark:bg-zinc-950"
                  />
                </div>
              </label>

              {candidates.length > 0 && (
                <ul className="max-h-40 overflow-y-auto rounded-lg border border-neutral-200 dark:border-zinc-800">
                  {candidates.map((user) => (
                    <li key={user.uid}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEmail(user.email)
                          setQuery(user.displayName || user.email)
                        }}
                        className={`flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-neutral-50 dark:hover:bg-zinc-800 ${
                          selectedEmail === user.email ? 'bg-blue-50 dark:bg-blue-950/30' : ''
                        }`}
                      >
                        <span className="font-medium">{user.displayName || user.email}</span>
                        <span className="text-xs text-neutral-500 dark:text-zinc-400">{user.email}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-neutral-500 dark:text-zinc-400">
                  Rol
                </span>
                <select
                  value={grantRole}
                  onChange={(event) => setGrantRole(event.target.value as 'reader' | 'writer')}
                  className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none input-brand-focus dark:border-zinc-700 dark:bg-zinc-950"
                >
                  <option value="reader">{roleLabel.reader}</option>
                  <option value="writer">{roleLabel.writer}</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-neutral-500 dark:text-zinc-400">
                  Motivo (mín. {MIN_REASON_LENGTH} caracteres)
                </span>
                <textarea
                  required
                  rows={2}
                  value={grantReason}
                  onChange={(event) => setGrantReason(event.target.value)}
                  className="w-full resize-none rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none input-brand-focus dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>

              <button
                type="submit"
                disabled={
                  acting ||
                  !selectedEmail ||
                  grantReason.trim().length < MIN_REASON_LENGTH
                }
                className="btn-primary inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
              >
                <UserPlus className="h-4 w-4" />
                {acting ? 'Guardando…' : 'Otorgar permiso'}
              </button>
            </form>
          </section>
        </div>
      </div>

      {revokeTarget && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 p-4">
          <form
            onSubmit={handleRevoke}
            className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
          >
            <h3 className="font-semibold">Revocar permiso</h3>
            <p className="mt-1 text-sm text-neutral-500 dark:text-zinc-400">
              {revokeTarget.displayName || revokeTarget.emailAddress}
            </p>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-xs font-medium">
                Motivo (mín. {MIN_REASON_LENGTH} caracteres)
              </span>
              <textarea
                required
                rows={3}
                autoFocus
                value={revokeReason}
                onChange={(event) => setRevokeReason(event.target.value)}
                className="w-full resize-none rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none input-brand-focus dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setRevokeTarget(null)
                  setRevokeReason('')
                }}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={acting || revokeReason.trim().length < MIN_REASON_LENGTH}
                className="rounded-lg btn-danger px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {acting ? 'Revocando…' : 'Revocar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
