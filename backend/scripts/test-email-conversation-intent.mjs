/**
 *   node backend/scripts/test-email-conversation-intent.mjs
 */

import { analyzeQuestionIntent } from '../lib/modules/rag/assistantIntent.js'

const history = [
  { role: 'user', content: 'Hace un resumen de ATM.docx' },
  {
    role: 'assistant',
    content:
      'El documento ATM.docx describe el procedimiento para la reposición de cartuchos…',
  },
  { role: 'user', content: 'Preparale un correo a mauro martinez para enviarle' },
  { role: 'assistant', content: 'Asunto es obligatorio.' },
]

const subjectTurn = analyzeQuestionIntent('Con el asunto "Resumen de documentos"', history)
const ok =
  subjectTurn.wantsEmail &&
  !subjectTurn.wantsSummarize &&
  subjectTurn.wantsEmailFromHistory

console.log(ok ? 'OK' : 'FAIL', subjectTurn)
process.exit(ok ? 0 : 1)
