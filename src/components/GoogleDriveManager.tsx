import {
  FileText,
  FolderOpen,
  HardDrive,
  Presentation,
  Table,
  Trash2,
} from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  createSharedFile,
  deleteSharedFile,
  getSharedFiles,
  type GoogleFileDepartment,
  type GoogleFileType,
  type GoogleSharedFile,
} from '../services/googleDriveService'

const DEPARTMENTS: GoogleFileDepartment[] = ['General', 'Sistemas', 'Operaciones']

const FILE_TYPES: {
  type: GoogleFileType
  label: string
  icon: typeof FolderOpen
}[] = [
  { type: 'folder', label: 'Carpeta', icon: FolderOpen },
  { type: 'sheet', label: 'Sheets', icon: Table },
  { type: 'doc', label: 'Docs', icon: FileText },
  { type: 'slide', label: 'Slides', icon: Presentation },
]

function TypeIcon({ type, className }: { type: GoogleFileType; className?: string }) {
  const config = FILE_TYPES.find((item) => item.type === type)
  const Icon = config?.icon ?? FileText
  return <Icon className={className} />
}

export function GoogleDriveManager() {
  const [files, setFiles] = useState<GoogleSharedFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<GoogleFileType>('doc')
  const [department, setDepartment] = useState<GoogleFileDepartment>('General')

  const loadFiles = useCallback(async () => {
    try {
      const data = await getSharedFiles()
      setFiles(data)
      setError(null)
    } catch (err) {
      console.error('Error al cargar archivos compartidos:', err)
      setFiles([])
      setError('No se pudieron cargar los archivos. Intentá nuevamente.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      await createSharedFile({
        title: title.trim(),
        url: url.trim(),
        type,
        department,
        description: description.trim(),
        allowedUsers: [],
      })

      toast.success('Archivo compartido guardado')
      setTitle('')
      setUrl('')
      setDescription('')
      setType('doc')
      setDepartment('General')
      await loadFiles()
    } catch (err) {
      console.error('Error al guardar archivo:', err)
      toast.error('Error al guardar el archivo')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string, fileTitle: string) => {
    const confirmed = window.confirm(
      `¿Eliminar "${fileTitle}"? Esta acción no se puede deshacer.`,
    )
    if (!confirmed) return

    setDeletingId(id)

    try {
      await deleteSharedFile(id)
      toast.success('Archivo eliminado')
      await loadFiles()
    } catch (err) {
      console.error('Error al eliminar archivo:', err)
      toast.error('Error al eliminar el archivo')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
        <div className="border-b border-gray-100 bg-gradient-to-r from-sky-50 to-white px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Archivos de Google Drive</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Centralizá links compartidos de Docs, Sheets, Slides y carpetas
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <label htmlFor="gdrive-title" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Título
              </label>
              <input
                id="gdrive-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Planilla de Guardias"
                className="w-full rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/60 px-4 py-3 text-sm outline-none transition-all focus:border-sky-500 focus:bg-white dark:bg-zinc-900 focus:ring-4 focus:ring-sky-500/10"
              />
            </div>

            <div>
              <label htmlFor="gdrive-url" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                URL de Drive
              </label>
              <input
                id="gdrive-url"
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://docs.google.com/..."
                className="w-full rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/60 px-4 py-3 text-sm outline-none transition-all focus:border-sky-500 focus:bg-white dark:bg-zinc-900 focus:ring-4 focus:ring-sky-500/10"
              />
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de archivo</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {FILE_TYPES.map((item) => {
                const Icon = item.icon
                const selected = type === item.type

                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => setType(item.type)}
                    className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-sm transition-all ${
                      selected
                        ? 'border-sky-500 bg-sky-50 text-sky-700 ring-2 ring-sky-500/20'
                        : 'border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/60 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:border-zinc-700 hover:bg-white dark:bg-zinc-900'
                    }`}
                  >
                    <Icon className="h-6 w-6" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label htmlFor="gdrive-department" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Departamento
            </label>
            <select
              id="gdrive-department"
              value={department}
              onChange={(e) => setDepartment(e.target.value as GoogleFileDepartment)}
              className="w-full max-w-sm rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/60 px-4 py-3 text-sm outline-none transition-all focus:border-sky-500 focus:bg-white dark:bg-zinc-900 focus:ring-4 focus:ring-sky-500/10"
            >
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="gdrive-description" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Descripción
            </label>
            <textarea
              id="gdrive-description"
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve descripción del recurso..."
              className="w-full resize-y rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/60 px-4 py-3 text-sm outline-none transition-all focus:border-sky-500 focus:bg-white dark:bg-zinc-900 focus:ring-4 focus:ring-sky-500/10"
            />
          </div>

          <div className="flex justify-end border-t border-gray-100 pt-5">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Guardando...' : 'Guardar enlace'}
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
        <div className="border-b border-gray-100 px-6 py-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Enlaces registrados</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {files.length} {files.length === 1 ? 'recurso' : 'recursos'} en total
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-600 border-t-transparent" />
          </div>
        ) : error ? (
          <p className="px-6 py-16 text-center text-sm text-red-600">{error}</p>
        ) : files.length === 0 ? (
          <p className="px-6 py-16 text-center text-sm text-gray-500 dark:text-gray-400">
            Aún no hay archivos compartidos registrados.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 dark:bg-zinc-900/60/80 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <th className="px-6 py-3">Recurso</th>
                  <th className="px-6 py-3">Tipo</th>
                  <th className="px-6 py-3">Departamento</th>
                  <th className="px-6 py-3">Acceso</th>
                  <th className="px-6 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {files.map((file) => (
                  <tr key={file.id} className="hover:bg-gray-50 dark:bg-zinc-900/60/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                          <TypeIcon type={file.type} className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">{file.title}</p>
                          <p className="line-clamp-1 text-xs text-gray-500 dark:text-gray-400">{file.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 capitalize text-gray-600 dark:text-gray-400">{file.type}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">
                        {file.department}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {!file.allowedUsers || file.allowedUsers.length === 0 ? (
                        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Público</span>
                      ) : (
                        <span className="text-xs text-neutral-500 dark:text-gray-400">
                          {file.allowedUsers.length}{' '}
                          {file.allowedUsers.length === 1 ? 'usuario' : 'usuarios'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => file.id && handleDelete(file.id, file.title)}
                        disabled={deletingId === file.id}
                        aria-label={`Eliminar ${file.title}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-red-500 transition-colors hover:bg-red-50 dark:bg-red-950/40 hover:text-red-700 dark:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
