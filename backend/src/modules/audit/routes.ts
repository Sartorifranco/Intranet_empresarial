import { Router } from 'express'
import { requireSuperAdmin, requireWorkspaceUser } from '../auth/middleware.js'
import { listAuditLogs } from './listLogs.js'

export const auditRouter = Router()

auditRouter.get('/logs', requireWorkspaceUser, requireSuperAdmin, listAuditLogs)
