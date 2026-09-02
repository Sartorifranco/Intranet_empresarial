import { KeyRound, Loader2, Search, Trash2, UserPlus, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import {
  grantBoardAccess,
  listBoardAccess,
  revokeBoardAccess,
  type BoardAccessUserDto,
} from '../services/boardsApi'
import { getAllUsers, type UserProfile } from '../services/userService'

interface BoardAccessModalProps {
  boardId: string
  boardName: string
  onClose: () => void
}

export function BoardAccessModal({ boardId, boardName, onClose }: BoardAccessModalProps) {
  const [allowedUsers, setAllowedUsers] = useState<BoardAccessUserDto[]>([])
  const [allUsers, setAllUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selectedEmail, setSelectedEmail] = useState('')
  const [grantReason, setGrantReason] = useState('')
  const [revokeTarget, setRevokeTarget] = useState<BoardAccessUserDto | null>(null)
  const [revokeReason, setRevokeReason] = useState('')
  const [acting, setActing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [access, users] = await Promise.all([listBoardAccess(boardId), getAllUsers()])
      setAllowedUsers(access.allowedUsers)
      setAllUsers(users)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo cargar el acceso')
    } finally {
      setLoading(false)
    }
  }, [boardId])

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

  const allowedIds = useMemo(() => new Set(allowedUsers.map((row) => row.uid)), [allowedUsers])

  const candidates = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es')
    return allUsers
      .filter((user) => user.role !== 'super_admin')
      .filter((user) => !allowedIds.has(user.uid))
      .filter((user) => {
        if (!normalized) return true
        const haystack = `${user.displayName ?? ''} ${user.email}`.toLocaleLowerCase('es')
        return haystack.includes(normalized)
      })
      .slice(0, 8)
  }, [allUsers, allowedIds, query])

  const handleGrant = async (event: FormEvent) => {
    event.preventDefault()
    if (!selectedEmail || !grantReason.trim()) return
    setActing(true)
    try {
      const result = await grantBoardAccess(boardId, selectedEmail, grantReason.trim())
      setAllowedUsers(result.allowedUsers)
      setSelectedEmail('')
      setGrantReason('')
      setQuery('')
      toast.success(result.granted ? 'Acceso otorgado' : 'El usuario ya tenía acceso')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo otorgar acceso')
    } finally {
      setActing(false)
    }
  }

  const handleRevoke = async (event: FormEvent) => {
    event.preventDefault()
    if (!revokeTarget || !revokeReason.trim()) return
    setActing(true)
    try {
      const result = await revokeBoardAccess(boardId, revokeTarget.uid, revokeReason.trim())
      setAllowedUsers(result.allowedUsers)
      setRevokeTarget(null)
      setRevokeReason('')
      toast.success('Acceso revocado')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo revocar acceso')
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
              <KeyRound className="h-4 w-4" />
              <p className="text-xs font-semibold uppercase tracking-wide">Acceso al tablero</p>
            </div>
            <h2 className="text-lg font-semibold">{boardName}</h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-zinc-400">
              Solo los usuarios listados pueden ver este tablero (super_admin siempre).
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
            <h3 className="mb-2 text-sm font-medium">Usuarios autorizados</h3>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
              </div>
            ) : allowedUsers.length === 0 ? (
              <p className="rounded-lg border border-dashed border-neutral-200 px-4 py-6 text-center text-sm text-neutral-500 dark:border-zinc-700 dark:text-zinc-400">
                Nadie tiene acceso todavía.
              </p>
            ) : (
              <ul className="space-y-2">
                {allowedUsers.map((row) => (
                  <li
                    key={row.uid}
                    className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-2.5 dark:border-zinc-800"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{row.displayName || row.email}</p>
                      <p className="truncate text-xs text-neutral-500 dark:text-zinc-400">{row.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRevokeTarget(row)}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-danger hover:bg-brand-tint dark:hover:bg-brand-primary-hover/30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-medium">Agregar usuario</h3>
            <form onSubmit={handleGrant} className="space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-neutral-500 dark:text-zinc-400">
                  Buscar
                </span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <input
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value)
                      setSelectedEmail('')
                    }}
                    placeholder="Nombre o email"
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
                  Motivo
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
                disabled={acting || !selectedEmail || !grantReason.trim()}
                className="btn-primary inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
              >
                <UserPlus className="h-4 w-4" />
                {acting ? 'Guardando…' : 'Otorgar acceso'}
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
            <h3 className="font-semibold">Revocar acceso</h3>
            <p className="mt-1 text-sm text-neutral-500 dark:text-zinc-400">
              {revokeTarget.displayName || revokeTarget.email}
            </p>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-xs font-medium">Motivo</span>
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
                disabled={acting || !revokeReason.trim()}
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
