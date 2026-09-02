import { ExternalLink, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { getDriveFile, type DriveFileDetailDto } from '../services/driveApi'
import { resolveGoogleDriveViewer } from '../utils/googleDriveEmbed'

const DEFAULT_RETURN = '/recursos'

function useReturnPath(): string {
  const location = useLocation()
  const state = location.state as { returnTo?: string } | null
  if (state?.returnTo && state.returnTo.startsWith('/')) {
    return state.returnTo
  }
  return DEFAULT_RETURN
}

function DriveDocumentViewer({ fileId }: { fileId: string }) {
  const navigate = useNavigate()
  const returnTo = useReturnPath()
  const [file, setFile] = useState<DriveFileDetailDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const viewer = useMemo(() => {
    if (!file) return null
    return resolveGoogleDriveViewer(file.mimeType, file.id, file.webViewLink)
  }, [file])

  const driveLink = file?.webViewLink ?? viewer?.nativeUrl ?? null

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      navigate(returnTo, { replace: true })
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navigate, returnTo])

  useEffect(() => {
    const previousOverflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const detail = await getDriveFile(fileId)
        if (cancelled) return
        setFile(detail)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo abrir el archivo')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [fileId])

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-white dark:bg-zinc-950">
      <div className="absolute left-4 top-4 z-20 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(returnTo, { replace: true })}
          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200/80 bg-white/75 px-3 py-2 text-sm font-medium text-neutral-700 shadow-sm backdrop-blur-sm transition-colors hover:bg-white hover:text-neutral-900 dark:border-zinc-700/80 dark:bg-zinc-900/75 dark:text-zinc-200 dark:hover:bg-zinc-900 dark:hover:text-white"
        >
          ← Volver
        </button>
      </div>

      {driveLink && (
        <div className="absolute right-4 top-4 z-20">
          <a
            href={driveLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200/80 bg-white/75 px-3 py-2 text-sm font-medium text-brand-primary shadow-sm backdrop-blur-sm transition-colors hover:bg-white dark:border-zinc-700/80 dark:bg-zinc-900/75 dark:hover:bg-zinc-900"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir en Google Drive
          </a>
        </div>
      )}

      {file && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-10 max-w-[min(24rem,calc(100%-12rem))] -translate-x-1/2 truncate px-4 text-center text-sm font-medium text-neutral-600 dark:text-zinc-400">
          {file.name}
        </div>
      )}

      {error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
          <div className="max-w-md rounded-xl alert-error px-4 py-6 text-sm text-danger">
            {error}
          </div>
          <Link
            to={returnTo}
            className="text-sm font-medium text-brand-primary hover:underline"
          >
            Volver a Archivos
          </Link>
        </div>
      ) : loading ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-neutral-500 dark:text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Preparando documento…
        </div>
      ) : !viewer?.embedUrl ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="max-w-md text-sm text-neutral-600 dark:text-zinc-400">
            Este tipo de archivo no se puede mostrar embebido. Abrilo en Google Drive.
          </p>
          {driveLink && (
            <a
              href={driveLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
            >
              <ExternalLink className="h-4 w-4" />
              Abrir en Google Drive
            </a>
          )}
        </div>
      ) : (
        <iframe
          title={file?.name ?? 'Documento'}
          src={viewer.embedUrl}
          className="h-full w-full flex-1 border-0 bg-white"
          allow="clipboard-read; clipboard-write; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      )}
    </div>
  )
}

export function DriveDocumentViewerPage() {
  const { fileId } = useParams()

  if (!fileId) return <Navigate to={DEFAULT_RETURN} replace />

  return <DriveDocumentViewer fileId={fileId} />
}
