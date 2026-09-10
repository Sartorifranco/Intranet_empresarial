/**
 *   node backend/scripts/test-summarize-filename-hint.mjs
 */

import { extractFileNameHintFromQuestion } from '../lib/modules/rag/assistantIntent.js'

const cases = [
  ['Hace un resumen de ATM.docx', 'ATM.docx'],
  ['resumime ATM.docx', 'ATM.docx'],
  ['Resumen del archivo "ATM.docx"', 'ATM.docx'],
  ['resumí los 3 pdf', undefined],
]

let failed = 0
for (const [question, expected] of cases) {
  const got = extractFileNameHintFromQuestion(question)
  const ok = got === expected
  console.log(`${ok ? '✓' : '✗'} ${question} → ${got ?? '(none)'}`)
  if (!ok) failed += 1
}

process.exit(failed === 0 ? 0 : 1)
