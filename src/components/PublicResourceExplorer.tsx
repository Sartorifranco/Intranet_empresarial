import {
  ChevronRight,
  ExternalLink,
  FileText,
  Folder,
  Link2,
  Table2,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context'
import {
  filterLevelContentsForUser,
  getFoldersAndItems,
  type Folder as FolderType,
  type ResourceItem,
} from '../services/folderService'

type BreadcrumbItem = { id: string | null; name: string }

const TYPE_LABELS: Record<ResourceItem['type'], string> = {
  link: 'Enlace',
  drive: 'Google Drive',
  form: 'Formulario',
  folder: 'Carpeta',
}

function ResourceIcon({ type, className }: { type: ResourceItem['type']; className?: string }) {
  switch (type) {
    case 'form':
      return <FileText className={className} />
    case 'drive':
      return <Table2 className={className} />
    case 'link':
      return <Link2 className={className} />
    default:
      return <Link2 className={className} />
  }
}

function ExplorerSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-lg border border-neutral-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <div className="mb-4 h-10 w-10 rounded-lg bg-neutral-100 dark:bg-zinc-800" />
          <div className="h-4 w-3/4 rounded bg-neutral-100 dark:bg-zinc-800" />
        </div>
      ))}
    </div>
  )
}

export function PublicResourceExplorer() {
  const { user } = useAuth()
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([{ id: null, name: 'Raíz' }])
  const [folders, setFolders] = useState<FolderType[]>([])
  const [items, setItems] = useState<ResourceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const currentFolderId = breadcrumb[breadcrumb.length - 1].id

  const loadContents = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await getFoldersAndItems(currentFolderId)
      const filtered = filterLevelContentsForUser(data, user?.uid)
      setFolders(filtered.folders)
      setItems(filtered.items)
    } catch (err) {
      console.error('Error al cargar recursos:', err)
      setError('No se pudieron cargar los recursos.')
      setFolders([])
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [currentFolderId, user?.uid])

  useEffect(() => {
    loadContents()
  }, [loadContents])

  const enterFolder = (folder: FolderType) => {
    if (!folder.id) return
    setBreadcrumb((prev) => [...prev, { id: folder.id!, name: folder.name }])
  }

  const navigateToBreadcrumb = (index: number) => {
    setBreadcrumb((prev) => prev.slice(0, index + 1))
  }

  const isEmpty = !loading && !error && folders.length === 0 && items.length === 0

  return (
    <div className="w-full">
      <nav
        aria-label="Ruta de navegación"
        className="mb-6 flex flex-wrap items-center gap-1 border-b border-neutral-200 dark:border-zinc-800 pb-4 text-sm"
      >
        {breadcrumb.map((crumb, index) => (
          <span key={crumb.id ?? 'root'} className="flex items-center gap-1">
            {index > 0 && <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300" />}
            <button
              type="button"
              onClick={() => navigateToBreadcrumb(index)}
              className={`rounded px-1.5 py-0.5 transition-colors ${
                index === breadcrumb.length - 1
                  ? 'font-semibold text-neutral-900 dark:text-gray-100'
                  : 'text-neutral-500 dark:text-gray-400 hover:text-brand-primary'
              }`}
            >
              {crumb.name}
            </button>
          </span>
        ))}
      </nav>

      {loading ? (
        <ExplorerSkeleton />
      ) : error ? (
        <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 px-6 py-12 text-center">
          <p className="text-sm font-medium text-red-700 dark:text-red-300">{error}</p>
        </div>
      ) : isEmpty ? (
        <div className="rounded-lg border border-dashed border-neutral-200 dark:border-zinc-800 bg-neutral-50 dark:bg-zinc-950 px-6 py-16 text-center">
          <Folder className="mx-auto mb-3 h-10 w-10 text-neutral-300" />
          <p className="text-sm font-medium text-neutral-700 dark:text-gray-300">No hay recursos en esta ubicación</p>
          <p className="mt-1 text-sm text-neutral-500 dark:text-gray-400">
            No tenés acceso a otros elementos o esta carpeta está vacía.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {folders.map((folder) => (
            <button
              key={folder.id}
              type="button"
              onClick={() => enterFolder(folder)}
              className="group flex flex-col items-start rounded-lg border border-neutral-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 text-left transition-all hover:border-neutral-300 dark:border-zinc-700 hover:shadow-sm"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-neutral-100 dark:bg-zinc-800 text-neutral-800 dark:text-gray-100 transition-colors group-hover:bg-neutral-900 group-hover:text-white">
                <Folder className="h-5 w-5" />
              </div>
              <span className="font-semibold text-neutral-900 dark:text-gray-100 group-hover:text-brand-primary">
                {folder.name}
              </span>
              <span className="mt-1 text-xs text-neutral-400">Carpeta</span>
            </button>
          ))}

          {items.map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-start rounded-lg border border-neutral-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 transition-all hover:border-red-200 dark:border-red-900/50 hover:shadow-sm"
            >
              <div className="mb-4 flex w-full items-start justify-between gap-2">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-neutral-50 dark:bg-zinc-950 text-neutral-700 dark:text-gray-300 ring-1 ring-neutral-100 transition-colors group-hover:ring-red-100 group-hover:text-brand-primary">
                  <ResourceIcon type={item.type} className="h-5 w-5" />
                </div>
                <ExternalLink className="h-4 w-4 shrink-0 text-neutral-300 transition-colors group-hover:text-brand-primary" />
              </div>
              <span className="font-semibold text-neutral-900 dark:text-gray-100 group-hover:text-brand-primary">
                {item.name}
              </span>
              <span className="mt-1 text-xs text-neutral-400">
                {TYPE_LABELS[item.type] ?? item.type}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
