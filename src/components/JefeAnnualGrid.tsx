import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  formatFullName,
  getJefeAssignmentsForYear,
  type ShiftJefeAssignment,
} from '../services/shiftService'
import {
  getShortWeekLabel,
  getWeekKey,
  getYearWeekKeys,
  groupYearWeeksByMonth,
} from '../utils/weekUtils'

interface JefeAnnualGridProps {
  selectedWeekKey: string
  onSelectWeek: (weekKey: string) => void
  refreshToken?: number
}

export function JefeAnnualGrid({
  selectedWeekKey,
  onSelectWeek,
  refreshToken = 0,
}: JefeAnnualGridProps) {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [assignments, setAssignments] = useState<Map<string, ShiftJefeAssignment>>(new Map())
  const [loading, setLoading] = useState(true)

  const monthGroups = useMemo(() => groupYearWeeksByMonth(year), [year])
  const totalWeeks = useMemo(() => getYearWeekKeys(year).length, [year])
  const assignedCount = useMemo(() => assignments.size, [assignments])
  const currentWeekKey = getWeekKey()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getJefeAssignmentsForYear(year)
      setAssignments(data)
    } catch (err) {
      console.error('Error al cargar grilla anual:', err)
      setAssignments(new Map())
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => {
    load()
  }, [load, refreshToken])

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
      <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 dark:text-gray-100">
            Grilla anual — jefes de turno
          </h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-gray-400">
            Planificá el año completo. Clic en una semana para editarla abajo.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <button
            type="button"
            onClick={() => setYear((y) => y - 1)}
            className="rounded-lg border border-neutral-200 p-2 text-neutral-600 hover:bg-neutral-50 dark:border-zinc-700 dark:text-gray-400 dark:hover:bg-zinc-800"
            aria-label="Año anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[4rem] text-center text-lg font-bold text-neutral-900 dark:text-gray-100">
            {year}
          </span>
          <button
            type="button"
            onClick={() => setYear((y) => y + 1)}
            className="rounded-lg border border-neutral-200 p-2 text-neutral-600 hover:bg-neutral-50 dark:border-zinc-700 dark:text-gray-400 dark:hover:bg-zinc-800"
            aria-label="Año siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {year !== currentYear && (
            <button
              type="button"
              onClick={() => setYear(currentYear)}
              className="rounded-lg px-2 py-1.5 text-xs font-semibold text-brand-primary hover:bg-brand-tint"
            >
              Hoy
            </button>
          )}
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-neutral-500 dark:text-gray-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border-2 border-brand-primary bg-brand-tint" />
          Semana actual
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-brand-primary/40 bg-brand-primary/10" />
          Asignada
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-dashed border-neutral-300 dark:border-zinc-600" />
          Sin asignar
        </span>
        <span className="ml-auto font-medium text-neutral-700 dark:text-gray-300">
          {assignedCount} / {totalWeeks} semanas cubiertas
        </span>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-neutral-100 dark:bg-zinc-800" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {monthGroups.map((group) => (
            <div key={group.month}>
              <h3 className="mb-2 text-sm font-semibold capitalize text-neutral-800 dark:text-gray-200">
                {group.monthLabel}
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {group.weeks.map(({ weekKey, weekIndex }) => {
                  const assignment = assignments.get(weekKey)
                  const fullName = assignment
                    ? formatFullName(assignment.firstName, assignment.lastName)
                    : ''
                  const isSelected = weekKey === selectedWeekKey
                  const isCurrent = weekKey === currentWeekKey
                  const isAssigned = Boolean(fullName)

                  return (
                    <button
                      key={weekKey}
                      type="button"
                      onClick={() => onSelectWeek(weekKey)}
                      className={`rounded-xl border p-2.5 text-left transition-all hover:shadow-sm ${
                        isSelected
                          ? 'border-brand-primary bg-brand-tint ring-2 ring-brand-primary/30 dark:bg-brand-tint'
                          : isCurrent
                            ? 'border-brand-primary bg-brand-tint/50'
                            : isAssigned
                              ? 'border-brand-primary/30 bg-brand-primary/5 dark:bg-brand-primary/10'
                              : 'border-dashed border-neutral-300 bg-neutral-50 dark:border-zinc-600 dark:bg-zinc-950/50'
                      }`}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-gray-500">
                        S{weekIndex}
                      </p>
                      <p className="mt-0.5 text-xs font-medium text-neutral-700 dark:text-gray-300">
                        {getShortWeekLabel(weekKey)}
                      </p>
                      {isAssigned ? (
                        <>
                          <p className="mt-1 truncate text-sm font-semibold text-neutral-900 dark:text-gray-100">
                            {fullName}
                          </p>
                          {assignment?.internalPhone && (
                            <p className="truncate text-[10px] text-neutral-500 dark:text-gray-400">
                              Int. {assignment.internalPhone}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="mt-1 text-xs italic text-neutral-400 dark:text-gray-500">
                          Sin asignar
                        </p>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
