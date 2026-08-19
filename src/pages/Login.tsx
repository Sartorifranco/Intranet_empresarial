import { type FormEvent, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { GoogleIcon } from '../components/GoogleIcon'
import { useAuth } from '../context'

function authErrorMessage(code: string): string {
  switch (code) {
    case 'auth/popup-closed-by-user':
      return 'Inicio de sesión cancelado.'
    case 'auth/account-exists-with-different-credential':
      return 'Ya existe una cuenta con este correo usando otro método.'
    default:
      return 'No se pudo iniciar sesión con Google. Intentá nuevamente.'
  }
}

export function Login() {
  const { login, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/admin'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      await login(email, password, rememberMe)
      navigate(from, { replace: true })
    } catch {
      setError('Credenciales incorrectas. Intentá nuevamente.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError('')
    setSubmitting(true)

    try {
      await loginWithGoogle(rememberMe)
      navigate(from, { replace: true })
    } catch (err) {
      const code = (err as { code?: string }).code ?? ''
      setError(authErrorMessage(code))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ backgroundColor: 'var(--color-surface)' }}>
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <img
            src="/logo-bacar.png"
            alt="Logo Bacar"
            className="mx-auto mb-4 h-12 w-12 object-contain"
          />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Acceso administrativo</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Ingresá con tu cuenta para acceder al panel
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-sm"
        >
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={submitting}
            className="mb-6 flex w-full items-center justify-center gap-3 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600"
          >
            <GoogleIcon className="h-5 w-5" />
            Continuar con Google
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-zinc-700" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-3 text-gray-500 dark:bg-zinc-900 dark:text-zinc-400">
                O
              </span>
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-brand-focus w-full rounded-lg border border-gray-300 dark:border-zinc-700 px-3 py-2.5 text-sm transition-colors"
              placeholder="usuario@empresa.com"
            />
          </div>

          <div className="mb-6">
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-brand-focus w-full rounded-lg border border-gray-300 dark:border-zinc-700 px-3 py-2.5 text-sm transition-colors"
              placeholder="••••••••"
            />
          </div>

          <div className="mb-4 flex items-center gap-2">
            <input
              id="remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 accent-red-900 dark:border-zinc-600 dark:bg-zinc-800"
            />
            <label
              htmlFor="remember-me"
              className="text-sm text-zinc-600 dark:text-zinc-400"
            >
              Recordarme en este equipo
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full rounded-lg py-2.5 text-sm font-medium"
          >
            {submitting ? 'Ingresando...' : 'Iniciar sesión'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          <Link to="/" className="text-brand-primary hover:underline">
            Volver a la intranet
          </Link>
        </p>
      </div>
    </div>
  )
}
