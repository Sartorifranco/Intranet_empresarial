import { Cake, Gift } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { getContacts, type EmployeeContact } from '../services/contactService'

interface BirthdayEntry {
  id: string
  name: string
  department: string
  birthdate: string
}

/**
 * Fuente única de cumpleaños: colección `contacts` (lectura pública).
 * Nota: cada usuario nuevo de la Intranet también necesita su registro en
 * `contacts` con `birthdate`; si no, el widget lo ignora en silencio.
 */
function contactsToBirthdayEntries(contacts: EmployeeContact[]): BirthdayEntry[] {
  return contacts
    .filter((contact) => Boolean(contact.birthdate))
    .map((contact) => ({
      id: contact.id ?? contact.email,
      name: contact.name,
      department: contact.department,
      birthdate: contact.birthdate!,
    }))
}

function getBirthdayDay(birthdate: string): number {
  return Number(birthdate.split('-')[2])
}

function isBirthdayThisMonth(birthdate: string): boolean {
  const currentMonth = new Date().getMonth() + 1
  const birthMonth = Number(birthdate.split('-')[1])
  return birthMonth === currentMonth
}

function formatBirthdayDay(day: number): string {
  return `${day} de ${new Date().toLocaleDateString('es-AR', { month: 'long' })}`
}

function BirthdaySkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-xl bg-white dark:bg-zinc-900/60 p-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-pink-200/50" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-3/4 rounded bg-pink-200/50" />
              <div className="h-2 w-1/2 rounded bg-pink-100/50" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function BirthdayWidget({
  variant = 'default',
}: {
  variant?: 'default' | 'minimal' | 'hub'
}) {
  const [entries, setEntries] = useState<BirthdayEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadBirthdays() {
      setLoading(true)

      try {
        const contacts = await getContacts()
        if (!cancelled) {
          setEntries(contactsToBirthdayEntries(contacts))
        }
      } catch (err) {
        console.error('Error al cargar cumpleaños:', err)
        if (!cancelled) setEntries([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadBirthdays()

    return () => {
      cancelled = true
    }
  }, [])

  const birthdaysThisMonth = useMemo(() => {
    return entries
      .filter((entry) => isBirthdayThisMonth(entry.birthdate))
      .sort((a, b) => getBirthdayDay(a.birthdate) - getBirthdayDay(b.birthdate))
  }, [entries])

  const currentMonthName = new Date()
    .toLocaleDateString('es-AR', { month: 'long' })
    .replace(/^\w/, (c) => c.toUpperCase())

  const minimal = variant === 'minimal'
  const hub = variant === 'hub'

  return (
    <div
      className={
        hub
          ? 'min-w-0 space-y-4'
          : minimal
            ? 'min-w-0 space-y-4'
            : 'overflow-hidden rounded-2xl border border-pink-200 bg-gradient-to-br from-pink-50 via-amber-50 to-orange-50 shadow-sm'
      }
    >
      <div className={hub || minimal ? '' : 'border-b border-pink-100/80 bg-white dark:bg-zinc-900/40 px-5 py-4'}>
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${
              hub || minimal
                ? 'bg-brand-tint text-brand-primary'
                : 'bg-gradient-to-br from-pink-500 to-rose-500 text-white shadow-sm'
            }`}
          >
            <Cake className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate font-semibold text-neutral-900 dark:text-gray-100">Cumpleaños del mes</h2>
            <p className={`text-xs ${hub || minimal ? 'text-neutral-500 dark:text-gray-400' : 'text-pink-700/80'}`}>
              {currentMonthName}
            </p>
          </div>
        </div>
      </div>

      <div className={hub || minimal ? '' : 'p-4'}>
        {loading ? (
          hub || minimal ? (
            <p className="text-sm text-neutral-400">Cargando cumpleaños...</p>
          ) : (
            <BirthdaySkeleton />
          )
        ) : birthdaysThisMonth.length === 0 ? (
          <div className={hub || minimal ? 'py-2' : 'rounded-xl bg-white dark:bg-zinc-900/50 px-4 py-6 text-center'}>
            {!hub && !minimal && <Gift className="mx-auto mb-2 h-8 w-8 text-pink-300" />}
            <p className="text-sm text-neutral-500 dark:text-gray-400">No hay cumpleaños este mes.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {birthdaysThisMonth.map((entry) => {
              const day = getBirthdayDay(entry.birthdate)
              const isToday = day === new Date().getDate()
              const compact = hub || minimal

              return (
                <li
                  key={entry.id}
                  className={`flex min-w-0 items-center gap-3 py-2 ${
                    compact
                      ? isToday
                        ? 'rounded-lg border border-brand-primary/15 bg-brand-tint/50 pl-3'
                        : 'border-b border-neutral-100 dark:border-zinc-800 pb-3 last:border-0'
                      : `rounded-xl border px-3 py-3 transition-colors ${
                          isToday
                            ? 'border-pink-300 bg-white dark:bg-zinc-900 shadow-sm ring-2 ring-pink-200/60'
                            : 'border-pink-100/80 bg-white dark:bg-zinc-900/70'
                        }`
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                      compact
                        ? isToday
                          ? 'bg-brand-primary text-white'
                          : 'bg-neutral-100 dark:bg-zinc-800 text-neutral-600 dark:text-gray-400'
                        : isToday
                          ? 'bg-gradient-to-br from-pink-500 to-rose-500 text-white'
                          : 'bg-pink-100 text-pink-600'
                    }`}
                  >
                    {isToday ? (
                      <Cake className="h-5 w-5" />
                    ) : (
                      <Gift className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-neutral-900 dark:text-gray-100">
                      {entry.name}
                      {isToday && (
                        <span
                          className={`ml-2 text-xs font-medium ${
                            compact ? 'text-brand-primary' : 'text-pink-600'
                          }`}
                        >
                          ¡Hoy!
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-neutral-500 dark:text-gray-400">{entry.department}</p>
                    <p
                      className={`mt-0.5 text-xs font-medium ${
                        compact ? 'text-neutral-600 dark:text-gray-400' : 'text-pink-700'
                      }`}
                    >
                      {formatBirthdayDay(day)}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
