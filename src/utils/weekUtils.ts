/** Lunes 00:00 local de la semana que contiene `date`. */
export function getMonday(date: Date = new Date()): Date {
  const monday = new Date(date)
  const day = monday.getDay()
  const offset = day === 0 ? -6 : 1 - day
  monday.setDate(monday.getDate() + offset)
  monday.setHours(0, 0, 0, 0)
  return monday
}

/** Clave de semana: fecha del lunes (YYYY-MM-DD). */
export function getWeekKey(date: Date = new Date()): string {
  return formatDateKey(getMonday(date))
}

export function formatDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

export function addWeeks(mondayKey: string, weeks: number): string {
  const date = parseDateKey(mondayKey)
  date.setDate(date.getDate() + weeks * 7)
  return formatDateKey(date)
}

export function weeksBetween(anchorMondayKey: string, targetMondayKey: string): number {
  const anchor = parseDateKey(anchorMondayKey).getTime()
  const target = parseDateKey(targetMondayKey).getTime()
  return Math.round((target - anchor) / (7 * 24 * 60 * 60 * 1000))
}

export function getWeekRangeLabel(mondayKey: string): string {
  const start = parseDateKey(mondayKey)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)

  const sameMonth = start.getMonth() === end.getMonth()
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }

  if (sameMonth) {
    return `${start.getDate()} – ${end.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}`
  }

  return `${start.toLocaleDateString('es-AR', opts)} – ${end.toLocaleDateString('es-AR', { ...opts, year: 'numeric' })}`
}

/** Semanas del año calendario (lunes dentro del 1 ene – 31 dic). */
export function getYearWeekKeys(year: number): string[] {
  const weeks: string[] = []
  let monday = getMonday(new Date(year, 0, 1))
  const end = new Date(year, 11, 31, 12, 0, 0, 0)

  while (monday <= end) {
    weeks.push(formatDateKey(monday))
    monday = new Date(monday)
    monday.setDate(monday.getDate() + 7)
  }

  return weeks
}

export interface MonthWeekGroup {
  month: number
  monthLabel: string
  weeks: Array<{ weekKey: string; weekIndex: number }>
}

export function groupYearWeeksByMonth(year: number): MonthWeekGroup[] {
  const weekKeys = getYearWeekKeys(year)
  const groups = new Map<number, MonthWeekGroup>()

  weekKeys.forEach((weekKey, index) => {
    const monday = parseDateKey(weekKey)
    const month = monday.getMonth()
    const monthLabel = monday.toLocaleDateString('es-AR', { month: 'long' })

    if (!groups.has(month)) {
      groups.set(month, { month, monthLabel, weeks: [] })
    }
    groups.get(month)!.weeks.push({ weekKey, weekIndex: index + 1 })
  })

  return Array.from(groups.values()).sort((a, b) => a.month - b.month)
}

export function getShortWeekLabel(mondayKey: string): string {
  const start = parseDateKey(mondayKey)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const sm = start.getMonth() === end.getMonth()
  if (sm) {
    return `${start.getDate()}–${end.getDate()} ${start.toLocaleDateString('es-AR', { month: 'short' })}`
  }
  return `${start.getDate()} ${start.toLocaleDateString('es-AR', { month: 'short' })} – ${end.getDate()} ${end.toLocaleDateString('es-AR', { month: 'short' })}`
}

export function getTodayDateKey(): string {
  return formatDateKey(new Date())
}

export function addDays(dateKey: string, days: number): string {
  const date = parseDateKey(dateKey)
  date.setDate(date.getDate() + days)
  return formatDateKey(date)
}

export function formatDateKeyLabel(dateKey: string): string {
  return parseDateKey(dateKey).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}
