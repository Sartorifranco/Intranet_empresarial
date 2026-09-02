import { ArrowRight, LayoutDashboard } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useBoardsVisibility } from '../../hooks/useBoardsVisibility'
import {
  ensureBoardSession,
  listBoards,
  type BoardDto,
} from '../../services/boardsApi'

function BoardCompactCard({ board }: { board: BoardDto }) {
  return (
    <Link
      to={`/tableros/${board.id}`}
      className="group flex min-w-0 items-center gap-3 overflow-hidden rounded-xl border border-neutral-200 bg-white p-3.5 transition-colors hover:border-brand-primary/35 dark:border-zinc-800 dark:bg-zinc-900 sm:gap-4 sm:p-4"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-brand-primary transition-colors group-hover:bg-brand-tint dark:bg-zinc-800 dark:group-hover:bg-brand-tint sm:h-12 sm:w-12">
        <LayoutDashboard className="h-5 w-5 sm:h-6 sm:w-6" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-semibold text-neutral-900 dark:text-gray-100">{board.name}</h3>
        <p className="mt-0.5 line-clamp-2 text-xs break-words text-neutral-500 dark:text-gray-400">
          Tablero interactivo de consulta
        </p>
      </div>
      <ArrowRight className="hidden h-4 w-4 shrink-0 text-neutral-300 transition-colors group-hover:text-brand-primary sm:block" />
    </Link>
  )
}

function BoardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-[4.5rem] animate-pulse rounded-xl border border-neutral-100 bg-neutral-50 dark:border-zinc-800 dark:bg-zinc-950"
        />
      ))}
    </div>
  )
}

export function HomeBoardsSection() {
  const boardsVisible = useBoardsVisibility()
  const [boards, setBoards] = useState<BoardDto[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      await ensureBoardSession()
      const result = await listBoards()
      setBoards(result.boards)
    } catch (err) {
      console.error('Error al cargar tableros para la home:', err)
      setBoards([])
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (boardsVisible !== true) return
    void load()
  }, [boardsVisible, load])

  if (boardsVisible !== true) return null

  if (!loading && !error && boards.length === 0) return null

  return (
    <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6 lg:p-8">
      <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-neutral-900 dark:text-gray-100">Tableros</h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-gray-400">
            Paneles de consulta a los que tenés acceso
          </p>
        </div>
        <Link
          to="/tableros"
          className="inline-flex w-full items-center justify-center gap-1.5 text-sm font-semibold text-brand-primary transition-colors hover:opacity-90 sm:w-auto sm:justify-start"
        >
          Ver todos
          <ArrowRight className="h-4 w-4 shrink-0" />
        </Link>
      </div>

      {loading ? (
        <BoardsSkeleton />
      ) : error ? (
        <p className="rounded-lg alert-error px-4 py-3 text-sm text-danger">
          No se pudieron cargar los tableros.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {boards.map((board) => (
            <BoardCompactCard key={board.id} board={board} />
          ))}
        </div>
      )}
    </section>
  )
}
