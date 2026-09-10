import type { RagConversationTurn } from './runRagAssistant.js'

export type PendingEmailDraftSnapshot = {
  to: string[]
  cc: string[]
  subject: string
  body: string
}

const DRAFT_BLOCK_RE =
  /\[Borrador de correo pendiente\]\s*\nPara:\s*([^\n]+)\n(?:CC:\s*([^\n]+)\n)?Asunto:\s*([^\n]+)\nMensaje:\s*\n([\s\S]*?)(?=\n\[Borrador de correo pendiente\]|$)/gi

const PREPARED_ACTIONS_STUB_RE =
  /^Prepar[eé]\s+\*\*\d+\s+de\s+\d+\*\*\s+acciones|Revis[aá]\s+cada\s+tarjeta/i

function parseEmailList(line: string): string[] {
  return line
    .split(/[,;]+/g)
    .map((part) => part.trim())
    .filter(Boolean)
}

export function extractPendingEmailDraftFromHistory(
  history: RagConversationTurn[],
): PendingEmailDraftSnapshot | undefined {
  const combined = history
    .filter((turn) => turn.role === 'assistant')
    .map((turn) => turn.content)
    .join('\n\n')

  let last: PendingEmailDraftSnapshot | undefined
  for (const match of combined.matchAll(DRAFT_BLOCK_RE)) {
    last = {
      to: parseEmailList(match[1] ?? ''),
      cc: parseEmailList(match[2] ?? ''),
      subject: (match[3] ?? '').trim(),
      body: (match[4] ?? '').trim(),
    }
  }
  if (last && last.body.length >= 10) return last

  const assistantBodies = history
    .filter((turn) => turn.role === 'assistant')
    .map((turn) => turn.content.trim())
    .reverse()

  for (const content of assistantBodies) {
    if (PREPARED_ACTIONS_STUB_RE.test(content)) continue
    if (content.length >= 200 && !content.includes('[Borrador de correo pendiente]')) {
      return {
        to: [],
        cc: [],
        subject: '',
        body: content,
      }
    }
  }

  return undefined
}

export function isEmailDraftFollowUpQuestion(question: string): boolean {
  const text = question.trim()
  if (!text) return false
  return (
    /\b(?:agreg(?:ar|a|á|ame|áme)?|sum(?:ar|a|á|ame|áme)?|inclu(?:ir|i|í|ime|íme)?|a[nñ]ad(?:ir|i|í|ime|íme)?|pon(?:er|e|é|eme|éme)?|met(?:er|e|é|eme|éme)?|copi(?:ar|a|á|ame|áme)?|cc|destinatario|participante)\b/i.test(
      text,
    ) && /\b(?:correo|mail|e-?mail|mensaje|borrador)\b/i.test(text)
  )
}
