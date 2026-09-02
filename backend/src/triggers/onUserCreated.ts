import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { applyPendingUserSetupForNewUser } from '../modules/users/applyPendingUserSetup.js'
import { logError } from '../lib/log.js'

export const applyPendingUserSetup = onDocumentCreated(
  {
    document: 'users/{uid}',
    region: 'southamerica-east1',
  },
  async (event) => {
    const snap = event.data
    if (!snap) return

    const uid = event.params.uid
    const email = typeof snap.get('email') === 'string' ? snap.get('email') : ''
    const displayName =
      typeof snap.get('displayName') === 'string' ? snap.get('displayName') : ''

    if (!email.trim()) {
      return
    }

    try {
      await applyPendingUserSetupForNewUser({
        uid,
        email,
        displayName,
      })
    } catch (err) {
      logError(`applyPendingUserSetup falló para users/${uid}`, err)
      throw err
    }
  },
)
