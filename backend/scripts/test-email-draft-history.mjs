/**
 *   node backend/scripts/test-email-draft-history.mjs
 */

import {
  extractPendingEmailDraftFromHistory,
  isEmailDraftFollowUpQuestion,
} from '../lib/modules/rag/emailDraftFromHistory.js'
import { lookupContactEmailByName } from '../lib/modules/rag/intranetContacts.js'

const history = [
  {
    role: 'assistant',
    content:
      'Preparé **1 de 1** acciones.\n\n[Borrador de correo pendiente]\nPara: admin@bacarsa.com.ar\nAsunto: Resumen de ATM.docx\nMensaje:\nEl documento ATM.docx describe el procedimiento.',
  },
]

const draft = extractPendingEmailDraftFromHistory(history)
console.log('draft ok:', draft?.to[0] === 'admin@bacarsa.com.ar' && draft.body.includes('ATM'))
console.log('follow-up:', isEmailDraftFollowUpQuestion('Podes agregar a Debora Quinteros al correo?'))

const lookup = lookupContactEmailByName('Debora Quinteros', [
  { name: 'Debora Quinteros', email: 'debora.quinteros@bacarsa.com.ar' },
])
console.log('lookup:', lookup.status === 'found' ? lookup.email : lookup.status)
