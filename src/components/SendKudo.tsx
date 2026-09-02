import { Heart, Send, X } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../context'
import { getContacts, type EmployeeContact } from '../services/contactService'
import {
  createKudo,
  KUDO_BADGES,
  KUDO_BADGE_EMOJI,
  type KudoBadge,
} from '../services/kudosService'

interface SendKudoProps {
  onSent?: () => void
}

export function SendKudo({ onSent }: SendKudoProps) {
  const { user, loading: authLoading } = useAuth()
  const [open, setOpen] = useState(false)
  const [contacts, setContacts] = useState<EmployeeContact[]>([])
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [recipientId, setRecipientId] = useState('')
  const [badge, setBadge] = useState<KudoBadge>('Compañerismo')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!open || !user) return

    setLoadingContacts(true)
    getContacts()
      .then(setContacts)
      .catch((err) => {
        console.error('Error al cargar contactos:', err)
        toast.error('No se pudieron cargar los compañeros')
      })
      .finally(() => setLoadingContacts(false))
  }, [open, user])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!user) return

    const contact = contacts.find((c) => c.id === recipientId)
    if (!contact) {
      toast.error('Seleccioná un compañero')
      return
    }

    const sender = user.displayName || user.email || 'Anónimo'

    setSubmitting(true)

    try {
      await createKudo({
        recipient: contact.name,
        sender,
        message,
        badge,
      })

      toast.success('¡Reconocimiento enviado!')
      setRecipientId('')
      setBadge('Compañerismo')
      setMessage('')
      setOpen(false)
      onSent?.()
    } catch (err) {
      console.error('Error al enviar kudo:', err)
      toast.error('No se pudo enviar el reconocimiento')
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading) {
    return null
  }

  if (!user) {
    return (
      <div className="rounded-2xl border border-dashed border-rose-200 bg-rose-50/50 px-5 py-4 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          <Link to="/" className="font-semibold text-rose-600 hover:underline">
            Iniciá sesión
          </Link>{' '}
          para enviar un reconocimiento a un compañero
        </p>
      </div>
    )
  }

  return (
    <div className="w-full min-w-0">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-600 bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-700 sm:w-auto"
        >
          <Heart className="h-4 w-4" />
          Enviar reconocimiento
        </button>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="w-full min-w-0 rounded-xl border border-rose-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:p-5"
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="break-words text-sm font-semibold text-gray-900 dark:text-gray-100 sm:text-base">Nuevo reconocimiento</h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:bg-zinc-800 hover:text-gray-600 dark:text-gray-400"
              aria-label="Cerrar formulario"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="kudo-recipient" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Compañero
              </label>
              <select
                id="kudo-recipient"
                required
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
                disabled={loadingContacts}
                className="w-full rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/60 px-4 py-2.5 text-sm outline-none focus:border-rose-400 focus:bg-white dark:bg-zinc-900 focus:ring-4 focus:ring-rose-400/10"
              >
                <option value="">
                  {loadingContacts ? 'Cargando contactos...' : 'Seleccioná un compañero'}
                </option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.name} — {contact.department}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Categoría</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {KUDO_BADGES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setBadge(item)}
                    className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-medium transition-all ${
                      badge === item
                        ? 'border-rose-400 bg-rose-50 text-rose-700 ring-2 ring-rose-400/20'
                        : 'border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/60 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:border-zinc-700'
                    }`}
                  >
                    <span className="text-lg">{KUDO_BADGE_EMOJI[item]}</span>
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="kudo-message" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Mensaje
              </label>
              <textarea
                id="kudo-message"
                required
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Contá por qué querés reconocer a tu compañero..."
                className="w-full resize-y rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/60 px-4 py-3 text-sm outline-none focus:border-rose-400 focus:bg-white dark:bg-zinc-900 focus:ring-4 focus:ring-rose-400/10"
              />
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full rounded-xl border border-gray-200 dark:border-zinc-800 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:bg-zinc-900/60 sm:w-auto"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-rose-500 px-5 py-2 text-sm font-semibold text-white hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                <Send className="h-4 w-4" />
                {submitting ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}
