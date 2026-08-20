import { HardDrive, Pencil, Settings2, Shield, Trash2, X } from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../context'
import { useDepartments } from '../hooks/useDepartments'
import {
  getSharedFiles,
  isSharedFilePublic,
  setUserFileAccess,
  type GoogleSharedFile,
} from '../services/googleDriveService'
import { getFoldersAndItems, type Folder } from '../services/folderService'
import {
  deleteUser,
  getAllUsers,
  isSuperAdmin,
  isSuperAdminEmail,
  updateManagedAreaIds,
  updateUserBasicInfo,
  updateUserPermissions,
  updateUserRole,
  type UserPermissions,
  type UserProfile,
} from '../services/userService'

const PERMISSION_FIELDS: {
  key: keyof UserPermissions
  label: string
  description: string
}[] = [
  {
    key: 'view_directory',
    label: 'Ver contactos',
    description: 'Acceso a la agenda de contactos internos',
  },
  {
    key: 'view_drive',
    label: 'Ver archivos compartidos',
    description: 'Acceso a recursos en Google Drive',
  },
  {
    key: 'view_links',
    label: 'Ver accesos directos',
    description: 'Visualización de enlaces útiles en la intranet',
  },
  {
    key: 'manage_news',
    label: 'Gestionar noticias',
    description: 'Crear y eliminar comunicados',
  },
  {
    key: 'manage_links',
    label: 'Gestionar enlaces',
    description: 'Administrar accesos directos',
  },
  {
    key: 'manage_users',
    label: 'Gestionar usuarios',
    description: 'Configurar permisos de otros usuarios',
  },
  {
    key: 'super_admin',
    label: 'Super administrador',
    description: 'Acceso total al panel de administración',
  },
]

function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-3 p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-12 rounded bg-neutral-100 dark:bg-zinc-800" />
      ))}
    </div>
  )
}

function PermissionSwitch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  description: string
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-neutral-100 dark:border-zinc-800 px-4 py-3 transition-colors hover:bg-neutral-50 dark:bg-zinc-950">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-neutral-900 dark:text-gray-100">{label}</p>
        <p className="mt-0.5 text-xs text-neutral-500 dark:text-gray-400">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-brand-primary' : 'bg-neutral-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white dark:bg-zinc-900 shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </label>
  )
}

interface PermissionsDrawerProps {
  user: UserProfile
  onClose: () => void
  onSaved: (uid: string) => void
}

function useDrawerEscape(onClose: () => void) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [onClose])
}

interface EditUserDrawerProps {
  user: UserProfile
  onClose: () => void
  onSaved: (uid: string) => void
}

function EditUserDrawer({ user, onClose, onSaved }: EditUserDrawerProps) {
  const { departments } = useDepartments()
  const [displayName, setDisplayName] = useState(user.displayName)
  const [email, setEmail] = useState(user.email)
  const [department, setDepartment] = useState(user.department)
  const [saving, setSaving] = useState(false)

  useDrawerEscape(onClose)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      await updateUserBasicInfo(user.uid, {
        displayName,
        email,
        department,
      })
      toast.success('Datos actualizados correctamente')
      onSaved(user.uid)
      onClose()
    } catch (err) {
      console.error('Error al actualizar usuario:', err)
      toast.error('No se pudieron guardar los cambios')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Cerrar panel"
        className="absolute inset-0 bg-neutral-900/40"
        onClick={onClose}
      />

      <aside className="relative flex h-full w-full max-w-md flex-col bg-white dark:bg-zinc-900 shadow-2xl">
        <header className="flex items-start justify-between border-b border-neutral-200 dark:border-zinc-800 px-6 py-5">
          <div>
            <p className="text-brand-primary text-xs font-semibold uppercase tracking-wide">
              Editar usuario
            </p>
            <h2 className="mt-1 text-lg font-bold text-neutral-900 dark:text-gray-100">{user.displayName}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-100 dark:bg-zinc-800 hover:text-neutral-700 dark:text-gray-300"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <div>
              <label
                htmlFor="edit-display-name"
                className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-gray-300"
              >
                Nombre completo
              </label>
              <input
                id="edit-display-name"
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="input-brand-focus w-full rounded-lg border border-neutral-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="edit-email"
                className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-gray-300"
              >
                Correo electrónico
              </label>
              <input
                id="edit-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-brand-focus w-full rounded-lg border border-neutral-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm"
              />
              <p className="mt-1.5 text-xs text-neutral-400">
                Solo actualiza el perfil en Firestore. Para cambiar la cuenta de Auth en
                producción, usá la consola de Firebase o una Cloud Function.
              </p>
            </div>

            <div>
              <label
                htmlFor="edit-department"
                className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-gray-300"
              >
                Departamento
              </label>
              <select
                id="edit-department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="input-brand-focus w-full rounded-lg border border-neutral-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm"
              >
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <footer className="flex gap-3 border-t border-neutral-200 dark:border-zinc-800 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-neutral-300 dark:border-zinc-700 px-4 py-2.5 text-sm font-medium text-neutral-700 dark:text-gray-300 transition-colors hover:bg-neutral-50 dark:bg-zinc-950"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold"
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </footer>
        </form>
      </aside>
    </div>
  )
}

function PermissionsDrawer({ user, onClose, onSaved }: PermissionsDrawerProps) {
  const [permissions, setPermissions] = useState<UserPermissions>({ ...user.permissions })
  const [saving, setSaving] = useState(false)
  const [driveFiles, setDriveFiles] = useState<GoogleSharedFile[]>([])
  const [driveLoading, setDriveLoading] = useState(true)
  const [togglingFileId, setTogglingFileId] = useState<string | null>(null)

  const loadDriveFiles = useCallback(async () => {
    try {
      const files = await getSharedFiles()
      setDriveFiles(files)
    } catch (err) {
      console.error('Error al cargar archivos de Drive:', err)
      setDriveFiles([])
    } finally {
      setDriveLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDriveFiles()
  }, [loadDriveFiles])

  useDrawerEscape(onClose)

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateUserPermissions(user.uid, permissions)
      toast.success('Permisos actualizados correctamente')
      onSaved(user.uid)
      onClose()
    } catch (err) {
      console.error('Error al actualizar permisos:', err)
      toast.error('No se pudieron guardar los permisos')
    } finally {
      setSaving(false)
    }
  }

  const togglePermission = (key: keyof UserPermissions, value: boolean) => {
    setPermissions((prev) => ({ ...prev, [key]: value }))
  }

  const hasFileAccess = (file: GoogleSharedFile) =>
    Boolean(file.allowedUsers?.includes(user.uid))

  const handleDriveAccessToggle = async (file: GoogleSharedFile, granted: boolean) => {
    if (!file.id) return

    setTogglingFileId(file.id)

    try {
      await setUserFileAccess(file.id, user.uid, granted)
      setDriveFiles((prev) =>
        prev.map((item) => {
          if (item.id !== file.id) return item
          const current = item.allowedUsers ?? []
          const next = granted
            ? current.includes(user.uid)
              ? current
              : [...current, user.uid]
            : current.filter((id) => id !== user.uid)
          return { ...item, allowedUsers: next }
        }),
      )
      toast.success(granted ? 'Acceso concedido' : 'Acceso revocado')
    } catch (err) {
      console.error('Error al actualizar acceso a Drive:', err)
      toast.error('No se pudo actualizar el acceso al archivo')
    } finally {
      setTogglingFileId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Cerrar panel"
        className="absolute inset-0 bg-neutral-900/40"
        onClick={onClose}
      />

      <aside className="relative flex h-full w-full max-w-lg flex-col bg-white dark:bg-zinc-900 shadow-2xl">
        <header className="flex items-start justify-between border-b border-neutral-200 dark:border-zinc-800 px-6 py-5">
          <div>
            <p className="text-brand-primary text-xs font-semibold uppercase tracking-wide">
              Permisos
            </p>
            <h2 className="mt-1 text-lg font-bold text-neutral-900 dark:text-gray-100">{user.displayName}</h2>
            <p className="text-sm text-neutral-500 dark:text-gray-400">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-100 dark:bg-zinc-800 hover:text-neutral-700 dark:text-gray-300"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <p className="mb-3 text-sm font-semibold text-neutral-900 dark:text-gray-100">Permisos granulares</p>
          <div className="space-y-2">
            {PERMISSION_FIELDS.map((field) => (
              <PermissionSwitch
                key={field.key}
                checked={permissions[field.key]}
                onChange={(value) => togglePermission(field.key, value)}
                label={field.label}
                description={field.description}
              />
            ))}
          </div>

          <div className="mt-8 border-t border-neutral-200 dark:border-zinc-800 pt-6">
            <div className="mb-3 flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-brand-primary" />
              <p className="text-sm font-semibold text-neutral-900 dark:text-gray-100">Accesos a Google Drive</p>
            </div>
            <p className="mb-4 text-xs text-neutral-500 dark:text-gray-400">
              Marcá los archivos a los que este usuario puede acceder. Los archivos públicos
              (sin restricción) son visibles para todos aunque no estén marcados.
            </p>

            {driveLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded-lg bg-neutral-100 dark:bg-zinc-800" />
                ))}
              </div>
            ) : driveFiles.length === 0 ? (
              <p className="rounded-lg border border-dashed border-neutral-200 dark:border-zinc-800 px-4 py-6 text-center text-sm text-neutral-500 dark:text-gray-400">
                No hay archivos de Google Drive registrados.
              </p>
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {driveFiles.map((file) => {
                  const checked = hasFileAccess(file)
                  const isPublic = isSharedFilePublic(file)

                  return (
                    <label
                      key={file.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors ${
                        checked
                          ? 'border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40/50'
                          : 'border-neutral-100 dark:border-zinc-800 hover:bg-neutral-50 dark:bg-zinc-950'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={togglingFileId === file.id}
                        onChange={(e) => handleDriveAccessToggle(file, e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-neutral-300 dark:border-zinc-700 text-brand-primary focus:ring-red-900/20"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-neutral-900 dark:text-gray-100">{file.title}</p>
                        <p className="text-xs text-neutral-500 dark:text-gray-400">
                          {file.department}
                          {isPublic && (
                            <span className="ml-2 text-neutral-400">· Público</span>
                          )}
                          {!isPublic && (
                            <span className="ml-2 text-neutral-400">
                              · {file.allowedUsers?.length ?? 0}{' '}
                              {(file.allowedUsers?.length ?? 0) === 1 ? 'usuario' : 'usuarios'}
                            </span>
                          )}
                        </p>
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <footer className="flex gap-3 border-t border-neutral-200 dark:border-zinc-800 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-neutral-300 dark:border-zinc-700 px-4 py-2.5 text-sm font-medium text-neutral-700 dark:text-gray-300 transition-colors hover:bg-neutral-50 dark:bg-zinc-950"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </footer>
      </aside>
    </div>
  )
}

type AssignableRole = 'admin' | 'user'

function isSharedAreasFolder(name: string): boolean {
  // TODO: excluir "Compartido entre áreas" por folder id fijo en vez de por nombre (más robusto ante espacios/typos)
  return name.trim().toLowerCase() === 'compartido entre áreas'
}

interface RoleAreasDrawerProps {
  user: UserProfile
  onClose: () => void
  onSaved: (uid: string) => void
}

function RoleAreasDrawer({ user, onClose, onSaved }: RoleAreasDrawerProps) {
  useDrawerEscape(onClose)

  const initialRole: AssignableRole = user.role === 'admin' ? 'admin' : 'user'
  const [draftRole, setDraftRole] = useState<AssignableRole>(initialRole)
  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>(
    () => [...(user.managedAreaIds ?? [])],
  )
  const [areas, setAreas] = useState<Folder[]>([])
  const [loadingAreas, setLoadingAreas] = useState(true)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoadingAreas(true)
    getFoldersAndItems(null)
      .then(({ folders }) => {
        if (cancelled) return
        setAreas(folders.filter((folder) => !isSharedAreasFolder(folder.name)))
      })
      .catch((err) => {
        console.error('Error al cargar áreas:', err)
        toast.error('No se pudieron cargar las áreas')
        if (!cancelled) setAreas([])
      })
      .finally(() => {
        if (!cancelled) setLoadingAreas(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const areaNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const folder of areas) {
      if (folder.id) map.set(folder.id, folder.name)
    }
    return map
  }, [areas])

  const toggleArea = (folderId: string) => {
    setSelectedAreaIds((prev) =>
      prev.includes(folderId)
        ? prev.filter((id) => id !== folderId)
        : [...prev, folderId],
    )
  }

  const handleConfirm = async () => {
    setSaving(true)
    try {
      await updateUserRole(user.uid, draftRole)
      if (draftRole === 'admin') {
        await updateManagedAreaIds(user.uid, selectedAreaIds)
      }
      toast.success('Rol actualizado')
      setConfirmOpen(false)
      onSaved(user.uid)
      onClose()
    } catch (err) {
      console.error('Error al guardar rol/áreas:', err)
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar el rol')
    } finally {
      setSaving(false)
    }
  }

  const selectedAreaLabels = selectedAreaIds.map(
    (id) => areaNameById.get(id) ?? id,
  )

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-md flex-col bg-white shadow-xl dark:bg-zinc-900">
        <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-4 dark:border-zinc-800">
          <div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-gray-100">
              Gestionar rol
            </h3>
            <p className="mt-0.5 truncate text-sm text-neutral-500 dark:text-gray-400">
              {user.displayName || user.email}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-zinc-800"
            aria-label="Cerrar drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <div>
            <label
              htmlFor="assign-role"
              className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-gray-300"
            >
              Rol
            </label>
            <select
              id="assign-role"
              value={draftRole}
              onChange={(e) => setDraftRole(e.target.value as AssignableRole)}
              className="input-brand-focus w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="user">Usuario</option>
              <option value="admin">Administrador de área</option>
            </select>
            <p className="mt-1.5 text-xs text-neutral-400">
              Super admin no se asigna desde aquí (solo Firestore Console).
            </p>
          </div>

          {draftRole === 'admin' && (
            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700 dark:text-gray-300">
                Áreas administradas
              </p>
              {loadingAreas ? (
                <p className="text-sm text-neutral-400">Cargando carpetas…</p>
              ) : areas.length === 0 ? (
                <p className="text-sm text-neutral-500">No hay áreas de primer nivel.</p>
              ) : (
                <ul className="space-y-2">
                  {areas.map((folder) => {
                    if (!folder.id) return null
                    const checked = selectedAreaIds.includes(folder.id)
                    return (
                      <li key={folder.id}>
                        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-neutral-100 px-3 py-2.5 hover:bg-neutral-50 dark:border-zinc-800 dark:hover:bg-zinc-950">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleArea(folder.id!)}
                            className="h-4 w-4 rounded border-neutral-300 text-brand-primary focus:ring-brand-primary"
                          />
                          <span className="text-sm text-neutral-800 dark:text-gray-200">
                            {folder.name}
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        <footer className="flex gap-3 border-t border-neutral-200 px-6 py-4 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700 dark:border-zinc-700 dark:text-gray-300"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="btn-primary flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold"
          >
            Guardar
          </button>
        </footer>
      </aside>

      {confirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="role-confirm-title"
            className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
          >
            <h4
              id="role-confirm-title"
              className="text-lg font-semibold text-neutral-900 dark:text-gray-100"
            >
              Confirmar cambio de rol
            </h4>
            <div className="mt-3 space-y-2 text-sm text-neutral-600 dark:text-gray-300">
              <p>
                <span className="font-medium text-neutral-800 dark:text-gray-100">Usuario:</span>{' '}
                {user.email}
              </p>
              <p>
                <span className="font-medium text-neutral-800 dark:text-gray-100">Rol:</span>{' '}
                {initialRole} → <span className="font-semibold text-brand-primary">{draftRole}</span>
              </p>
              {draftRole === 'admin' && (
                <p>
                  <span className="font-medium text-neutral-800 dark:text-gray-100">Áreas:</span>{' '}
                  {selectedAreaLabels.length > 0
                    ? selectedAreaLabels.join(', ')
                    : '(ninguna)'}
                </p>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={saving}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-zinc-600"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={saving}
                className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? 'Guardando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function UserManager() {
  const { user: currentAuthUser, userProfile, refreshProfile } = useAuth()
  const canAssignRoles =
    isSuperAdmin(userProfile) || isSuperAdminEmail(userProfile?.email)
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [permissionsUser, setPermissionsUser] = useState<UserProfile | null>(null)
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null)
  const [roleUser, setRoleUser] = useState<UserProfile | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadUsers = useCallback(async () => {
    try {
      const data = await getAllUsers()
      setUsers(data)
      setError(null)
    } catch (err) {
      console.error('Error al cargar usuarios:', err)
      setUsers([])
      setError('No se pudieron cargar los usuarios.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const handleSaved = async (uid: string) => {
    await loadUsers()
    if (currentAuthUser?.uid === uid) {
      await refreshProfile()
    }
  }

  const handleDelete = async (user: UserProfile) => {
    if (user.uid === currentAuthUser?.uid) {
      toast.error('No podés eliminar tu propia cuenta desde aquí')
      return
    }

    const confirmed = window.confirm(
      `¿Eliminar definitivamente a "${user.displayName || user.email}"?\n\n` +
        'Se borrará su perfil en Firestore y se revocará su acceso a archivos restringidos.\n' +
        'La cuenta en Firebase Authentication deberá eliminarse por separado en la consola de Firebase.',
    )
    if (!confirmed) return

    setDeletingId(user.uid)

    try {
      await deleteUser(user.uid)
      toast.success('Usuario eliminado del sistema')
      await loadUsers()
      if (permissionsUser?.uid === user.uid) setPermissionsUser(null)
      if (editingUser?.uid === user.uid) setEditingUser(null)
      if (roleUser?.uid === user.uid) setRoleUser(null)
    } catch (err) {
      console.error('Error al eliminar usuario:', err)
      toast.error('No se pudo eliminar el usuario')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className="w-full">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-neutral-900 dark:text-gray-100">Usuarios registrados</h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-gray-400">
          Gestioná datos, permisos y accesos de cada cuenta
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-zinc-800 bg-neutral-50 dark:bg-zinc-950">
                <th className="px-5 py-3.5 font-semibold text-neutral-700 dark:text-gray-300">Nombre</th>
                <th className="px-5 py-3.5 font-semibold text-neutral-700 dark:text-gray-300">Email</th>
                <th className="px-5 py-3.5 font-semibold text-neutral-700 dark:text-gray-300">Departamento</th>
                {canAssignRoles && (
                  <th className="px-5 py-3.5 font-semibold text-neutral-700 dark:text-gray-300">Rol</th>
                )}
                <th className="px-5 py-3.5 text-right font-semibold text-neutral-700 dark:text-gray-300">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={canAssignRoles ? 5 : 4}>
                    <TableSkeleton />
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td
                    colSpan={canAssignRoles ? 5 : 4}
                    className="px-5 py-12 text-center text-red-700 dark:text-red-300"
                  >
                    {error}
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td
                    colSpan={canAssignRoles ? 5 : 4}
                    className="px-5 py-12 text-center text-neutral-500 dark:text-gray-400"
                  >
                    No hay usuarios registrados.
                  </td>
                </tr>
              ) : (
                users.map((user, index) => (
                  <tr
                    key={user.uid}
                    className={`border-b border-neutral-100 dark:border-zinc-800 transition-colors hover:bg-neutral-50 dark:bg-zinc-950/80 ${
                      index === users.length - 1 ? 'border-b-0' : ''
                    }`}
                  >
                    <td className="px-5 py-4 font-medium text-neutral-900 dark:text-gray-100">
                      {user.displayName || '—'}
                    </td>
                    <td className="px-5 py-4 text-neutral-600 dark:text-gray-400">{user.email}</td>
                    <td className="px-5 py-4 text-neutral-600 dark:text-gray-400">{user.department}</td>
                    {canAssignRoles && (
                      <td className="px-5 py-4">
                        {user.role === 'super_admin' ? (
                          <span className="inline-flex rounded-full bg-brand-primary/10 px-2.5 py-0.5 text-xs font-semibold text-brand-primary">
                            Super admin
                          </span>
                        ) : user.role === 'admin' ? (
                          <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                            Admin de área
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600 dark:bg-zinc-800 dark:text-gray-400">
                            Usuario
                          </span>
                        )}
                      </td>
                    )}
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingUser(user)}
                          aria-label={`Editar ${user.displayName}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-neutral-600 dark:text-gray-400 transition-colors hover:bg-neutral-100 dark:bg-zinc-800 hover:text-neutral-900 dark:text-gray-100"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {canAssignRoles && user.role !== 'super_admin' && (
                          <button
                            type="button"
                            onClick={() => setRoleUser(user)}
                            aria-label={`Gestionar rol de ${user.displayName}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:bg-amber-50 hover:text-amber-800 dark:text-gray-400 dark:hover:bg-amber-950/40 dark:hover:text-amber-300"
                          >
                            <Shield className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(user)}
                          disabled={deletingId === user.uid}
                          aria-label={`Eliminar ${user.displayName}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-brand-primary transition-colors hover:bg-red-50 dark:bg-red-950/40 disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPermissionsUser(user)}
                          aria-label={`Configurar permisos de ${user.displayName}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-neutral-600 dark:text-gray-400 transition-colors hover:border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:bg-red-950/40 hover:text-brand-primary"
                        >
                          <Settings2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && users.length > 0 && (
          <div className="border-t border-neutral-200 dark:border-zinc-800 bg-neutral-50 dark:bg-zinc-950 px-5 py-3 text-xs text-neutral-500 dark:text-gray-400">
            {users.length} {users.length === 1 ? 'usuario' : 'usuarios'}
          </div>
        )}
      </div>

      {editingUser && (
        <EditUserDrawer
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={handleSaved}
        />
      )}

      {permissionsUser && (
        <PermissionsDrawer
          user={permissionsUser}
          onClose={() => setPermissionsUser(null)}
          onSaved={handleSaved}
        />
      )}

      {roleUser && canAssignRoles && (
        <RoleAreasDrawer
          user={roleUser}
          onClose={() => setRoleUser(null)}
          onSaved={handleSaved}
        />
      )}
    </section>
  )
}
