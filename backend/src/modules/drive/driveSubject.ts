import type { AuthedUser } from '../auth/middleware.js'
import { getEnv } from '../../config/env.js'

/** Subject de impersonación Drive según rol del usuario autenticado. */
export function resolveDriveSubject(user: AuthedUser): string {
  if (user.role === 'super_admin') {
    return getEnv().driveImpersonateEmail
  }
  return user.email
}
