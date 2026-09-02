import cors from 'cors'
import express from 'express'
import { auditRouter } from './modules/audit/routes.js'
import { boardsRouter } from './modules/boards/routes.js'
import { driveRouter } from './modules/drive/routes.js'
import { usersRouter } from './modules/users/routes.js'

const app = express()

app.disable('x-powered-by')
app.use(express.json({ limit: '1mb' }))
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'https://intranet-bacar.web.app',
      'https://intranet-bacar.firebaseapp.com',
    ],
    credentials: true,
  }),
)

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.use('/api/drive', driveRouter)
app.use('/api/boards', boardsRouter)
app.use('/api/audit', auditRouter)
app.use('/api/users', usersRouter)

app.use((_req, res) => {
  res.status(404).json({ error: 'No encontrado' })
})

export { app }
