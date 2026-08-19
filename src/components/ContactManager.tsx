import { Contact, Pencil, Trash2, X } from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  createContact,
  deleteContact,
  getContacts,
  updateContact,
  type EmployeeContact,
} from '../services/contactService'
import { useContactDepartments } from '../hooks/useDepartments'

const EMPTY_FORM = {
  name: '',
  position: '',
  department: '',
  email: '',
  internalPhone: '',
  birthdate: '',
}

const inputClassName =
  'input-brand-focus w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-100 dark:placeholder:text-zinc-500 dark:focus:bg-zinc-800'

export function ContactManager() {
  const { departments, loading: departmentsLoading } = useContactDepartments()
  const [contacts, setContacts] = useState<EmployeeContact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    if (!form.department && departments.length > 0) {
      setForm((prev) => ({ ...prev, department: departments[0] }))
    }
  }, [departments, form.department])

  const loadContacts = useCallback(async () => {
    try {
      const data = await getContacts()
      setContacts(data)
      setError(null)
    } catch (err) {
      console.error('Error al cargar los contactos:', err)
      setContacts([])
      setError('No se pudieron cargar los contactos. Intentá nuevamente.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadContacts()
  }, [loadContacts])

  const resetForm = () => {
    setForm({
      ...EMPTY_FORM,
      department: departments[0] ?? '',
    })
    setEditingId(null)
  }

  const handleEdit = (contact: EmployeeContact) => {
    setEditingId(contact.id ?? null)
    setForm({
      name: contact.name,
      position: contact.position,
      department: contact.department,
      email: contact.email,
      internalPhone: contact.internalPhone,
      birthdate: contact.birthdate ?? '',
    })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    const payload = {
      name: form.name.trim(),
      position: form.position.trim(),
      department: form.department,
      email: form.email.trim(),
      internalPhone: form.internalPhone.trim(),
      ...(form.birthdate ? { birthdate: form.birthdate } : {}),
    }

    try {
      if (editingId) {
        await updateContact(editingId, payload)
        toast.success('Contacto actualizado correctamente')
      } else {
        await createContact(payload)
        toast.success('Contacto registrado correctamente')
      }

      resetForm()
      await loadContacts()
    } catch (err) {
      console.error('Error al guardar el contacto:', err)
      toast.error(
        editingId ? 'Error al actualizar el contacto' : 'Error al registrar el contacto',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string, contactName: string) => {
    const confirmed = window.confirm(
      `¿Eliminar el contacto "${contactName}"? Esta acción no se puede deshacer.`,
    )
    if (!confirmed) return

    setDeletingId(id)

    try {
      await deleteContact(id)
      toast.success('Contacto eliminado')

      if (editingId === id) {
        resetForm()
      }

      await loadContacts()
    } catch (err) {
      console.error('Error al eliminar el contacto:', err)
      toast.error('Error al eliminar el contacto')
    } finally {
      setDeletingId(null)
    }
  }

  const updateField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-8 xl:grid-cols-5">
        <section className="card-minimal overflow-hidden xl:col-span-2">
          <div className="border-b border-neutral-200 bg-neutral-50 px-6 py-5 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-900 text-white">
                  <Contact className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900 dark:text-gray-100">
                    {editingId ? 'Editar contacto' : 'Nuevo contacto'}
                  </h2>
                  <p className="text-sm text-neutral-500 dark:text-gray-400">
                    {editingId
                      ? 'Modificá los datos y guardá los cambios'
                      : 'Registrá un empleado en la agenda interna'}
                  </p>
                </div>
              </div>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-zinc-800 dark:hover:text-gray-200"
                  aria-label="Cancelar edición"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 p-6">
            <div>
              <label
                htmlFor="contact-name"
                className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-gray-300"
              >
                Nombre
              </label>
              <input
                id="contact-name"
                type="text"
                required
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="Nombre completo"
                className={inputClassName}
              />
            </div>

            <div>
              <label
                htmlFor="contact-position"
                className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-gray-300"
              >
                Puesto
              </label>
              <input
                id="contact-position"
                type="text"
                required
                value={form.position}
                onChange={(e) => updateField('position', e.target.value)}
                placeholder="Cargo o puesto"
                className={inputClassName}
              />
            </div>

            <div>
              <label
                htmlFor="contact-department"
                className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-gray-300"
              >
                Departamento
              </label>
              <select
                id="contact-department"
                value={form.department}
                onChange={(e) => updateField('department', e.target.value)}
                className={inputClassName}
                disabled={departmentsLoading || departments.length === 0}
              >
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="contact-email"
                className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-gray-300"
              >
                Email
              </label>
              <input
                id="contact-email"
                type="email"
                required
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="correo@empresa.com"
                className={inputClassName}
              />
            </div>

            <div>
              <label
                htmlFor="contact-phone"
                className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-gray-300"
              >
                Interno
              </label>
              <input
                id="contact-phone"
                type="text"
                required
                value={form.internalPhone}
                onChange={(e) => updateField('internalPhone', e.target.value)}
                placeholder="Ej: 1234"
                className={inputClassName}
              />
            </div>

            <div>
              <label
                htmlFor="contact-birthdate"
                className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-gray-300"
              >
                Fecha de nacimiento
              </label>
              <input
                id="contact-birthdate"
                type="date"
                value={form.birthdate}
                onChange={(e) => updateField('birthdate', e.target.value)}
                className={`${inputClassName} [color-scheme:dark]`}
              />
              <p className="mt-1 text-xs text-neutral-400 dark:text-zinc-500">
                Opcional. Formato YYYY-MM-DD
              </p>
            </div>

            <div className="flex gap-3 border-t border-neutral-200 pt-5 dark:border-zinc-800">
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-neutral-200 px-5 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50 dark:border-zinc-700 dark:text-gray-300 dark:hover:bg-zinc-800"
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary ml-auto rounded-xl px-6 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting
                  ? 'Guardando...'
                  : editingId
                    ? 'Actualizar contacto'
                    : 'Guardar contacto'}
              </button>
            </div>
          </form>
        </section>

        <section className="card-minimal overflow-hidden xl:col-span-3">
          <div className="border-b border-neutral-200 bg-neutral-50 px-6 py-5 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-gray-100">
              Agenda de contactos
            </h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-gray-400">
              {contacts.length} {contacts.length === 1 ? 'contacto' : 'contactos'} registrados
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="spinner-brand h-8 w-8 animate-spin rounded-full border-4" />
            </div>
          ) : error ? (
            <p className="px-6 py-16 text-center text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : contacts.length === 0 ? (
            <p className="px-6 py-16 text-center text-sm text-neutral-500 dark:text-gray-400">
              Aún no hay contactos registrados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                    <th className="px-6 py-3">Nombre</th>
                    <th className="px-6 py-3">Puesto</th>
                    <th className="px-6 py-3">Departamento</th>
                    <th className="px-6 py-3">Contacto</th>
                    <th className="px-6 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-zinc-800">
                  {contacts.map((contact) => (
                    <tr
                      key={contact.id}
                      className={`transition-colors ${
                        editingId === contact.id
                          ? 'bg-red-50/60 dark:bg-red-950/20'
                          : 'hover:bg-neutral-50 dark:hover:bg-zinc-800/50'
                      }`}
                    >
                      <td className="px-6 py-4 font-medium text-neutral-900 dark:text-gray-100">
                        {contact.name}
                      </td>
                      <td className="px-6 py-4 text-neutral-600 dark:text-gray-400">
                        {contact.position}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-900 dark:bg-red-950/40 dark:text-red-300">
                          {contact.department}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-neutral-600 dark:text-gray-400">{contact.email}</p>
                        <p className="text-xs text-neutral-400 dark:text-zinc-500">
                          Int. {contact.internalPhone}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleEdit(contact)}
                            aria-label={`Editar ${contact.name}`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-red-50 hover:text-red-900 dark:text-gray-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => contact.id && handleDelete(contact.id, contact.name)}
                            disabled={deletingId === contact.id}
                            aria-label={`Eliminar ${contact.name}`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
