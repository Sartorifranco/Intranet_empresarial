import { Building2, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useGlobalSettings } from '../context/GlobalSettingsContext'
import {
  DEFAULT_DEPARTMENTS,
  updateDepartments,
} from '../services/configService'

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export function DepartmentManager() {
  const { settings, loading } = useGlobalSettings()
  const [departments, setDepartments] = useState<string[]>([...DEFAULT_DEPARTMENTS])
  const [newDepartment, setNewDepartment] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!loading) {
      setDepartments(settings.departments)
    }
  }, [settings.departments, loading])

  const handleAdd = (e: FormEvent) => {
    e.preventDefault()

    const name = normalizeName(newDepartment)
    if (!name) return

    const exists = departments.some(
      (department) => department.toLocaleLowerCase('es-AR') === name.toLocaleLowerCase('es-AR'),
    )

    if (exists) {
      toast.error('Ese departamento ya existe')
      return
    }

    setDepartments((current) =>
      [...current, name].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })),
    )
    setNewDepartment('')
  }

  const handleRemove = (name: string) => {
    if (departments.length <= 1) {
      toast.error('Debe quedar al menos un departamento')
      return
    }

    setDepartments((current) => current.filter((department) => department !== name))
  }

  const handleRestoreDefaults = () => {
    setDepartments([...DEFAULT_DEPARTMENTS])
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateDepartments(departments)
      toast.success('Departamentos actualizados')
    } catch (err) {
      console.error('Error al guardar departamentos:', err)
      toast.error('No se pudieron guardar los departamentos')
    } finally {
      setSaving(false)
    }
  }

  const hasChanges =
    departments.length !== settings.departments.length ||
    departments.some((department, index) => department !== settings.departments[index])

  return (
    <section className="card-minimal overflow-hidden">
      <div className="border-b border-neutral-200 bg-neutral-50 px-6 py-5 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary text-white">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-gray-100">
              Departamentos
            </h2>
            <p className="text-sm text-neutral-500 dark:text-gray-400">
              Gestioná la lista usada en registro, usuarios y contactos
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-6">
        <form onSubmit={handleAdd} className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={newDepartment}
            onChange={(e) => setNewDepartment(e.target.value)}
            placeholder="Ej: Comercial, Logística, Marketing..."
            className="input-brand-focus flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-100 dark:placeholder:text-zinc-500 dark:focus:bg-zinc-800"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-5 py-3 text-sm font-medium text-neutral-800 transition-colors hover:border-brand-primary/30 hover:text-brand-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-100 dark:hover:border-brand-primary/40 dark:hover:text-brand-primary"
          >
            <Plus className="h-4 w-4" />
            Agregar
          </button>
        </form>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="spinner-brand h-8 w-8 animate-spin rounded-full border-4" />
          </div>
        ) : (
          <ul className="space-y-2">
            {departments.map((department) => (
              <li
                key={department}
                className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/60"
              >
                <span className="font-medium text-neutral-900 dark:text-gray-100">
                  {department}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(department)}
                  aria-label={`Eliminar ${department}`}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-danger transition-colors hover:bg-brand-tint hover:text-danger dark:text-brand-primary dark:hover:bg-brand-primary-hover/40 dark:hover:text-brand-primary"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-3 border-t border-neutral-200 pt-5 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={handleRestoreDefaults}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50 dark:border-zinc-700 dark:text-gray-300 dark:hover:bg-zinc-800"
          >
            <RotateCcw className="h-4 w-4" />
            Restaurar lista base
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="btn-primary rounded-xl px-6 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Guardando...' : 'Guardar departamentos'}
          </button>
        </div>
      </div>
    </section>
  )
}
