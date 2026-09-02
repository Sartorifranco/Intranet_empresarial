import { Router } from 'express'
import { requireWorkspaceUser } from '../auth/middleware.js'
import {
  getBoardsVisibility,
  grantBoardAccessHandler,
  listBoardAccess,
  revokeBoardAccessHandler,
} from './boardAccessHandlers.js'
import { listBoards } from './listBoards.js'
import { createBoardSession, recordBoardOpen } from './sessionHandlers.js'
import { serveBoardAsset } from './serveAsset.js'

export const boardsRouter = Router()

boardsRouter.post('/session', requireWorkspaceUser, createBoardSession)

boardsRouter.get('/visibility', requireWorkspaceUser, getBoardsVisibility)

boardsRouter.get('/', requireWorkspaceUser, listBoards)

boardsRouter.get('/:boardFolderId/access', requireWorkspaceUser, listBoardAccess)
boardsRouter.post('/:boardFolderId/access', requireWorkspaceUser, grantBoardAccessHandler)
boardsRouter.delete('/:boardFolderId/access/:uid', requireWorkspaceUser, revokeBoardAccessHandler)

boardsRouter.post('/:boardFolderId/open', requireWorkspaceUser, recordBoardOpen)

boardsRouter.get('/:boardFolderId', serveBoardAsset)
boardsRouter.get('/:boardFolderId/*', serveBoardAsset)
