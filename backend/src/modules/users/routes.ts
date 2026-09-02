import type { Request, Response } from 'express'
import { Router } from 'express'
import { requireWorkspaceUser } from '../auth/middleware.js'
import { applyPendingUserSetupForNewUser } from './applyPendingUserSetup.js'

export const usersRouter = Router()

/** Respaldo del trigger Firestore: aplica pendingUserSetup al perfil autenticado (idempotente). */
usersRouter.post(
  '/apply-pending-setup',
  requireWorkspaceUser,
  async (req: Request, res: Response): Promise<void> => {
    const user = req.authedUser
    if (!user) {
      res.status(401).json({ error: 'No autenticado' })
      return
    }

    const result = await applyPendingUserSetupForNewUser({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
    })

    res.json(result)
  },
)
