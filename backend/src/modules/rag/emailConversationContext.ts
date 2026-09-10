import type { RagConversationTurn } from './runRagAssistant.js'

/** Usuario aclara el asunto del mail (no pide resumir documentos). */
const EMAIL_SUBJECT_CLARIFICATION_RE =
  /^(?:con\s+)?(?:el\s+)?asunto\b|(?:ponle|pus(?:ale|e))\s+(?:el\s+)?asunto\b|(?:el\s+)?asunto\s+(?:es|ser[aá])\b/im

const EMAIL_PREP_EXTENDED_RE =
  /\b(envi[aá](r|me|le|ale|ame)?|mand[aá](r|me|le|ale|ame)?|correos?|mails?|e-?mails?|prepar[aá](?:me|le|ale|ále)?)\b/i

const RECENT_EMAIL_USER_RE =
  /\b(prepar(?:a|á|ar|ale|ále)|envi[aá](?:r|le|ale|ame)?|mand[aá](?:r|le|ale|ame)?|correo|mail)\b/i

const RECENT_EMAIL_FAILURE_RE =
  /Asunto es obligatorio|no pude preparar.*correo|prepar(?:e|ar)\s+\*\*\d+/i

export function extractEmailSubjectFromText(question: string): string | null {
  const text = question.trim()
  if (!text) return null

  const quoted =
    /asunto\s+"([^"]+)"/i.exec(text) ??
    /asunto\s+'([^']+)'/i.exec(text) ??
    /asunto\s+[«""]([^»""]+)[»""]/i.exec(text)
  if (quoted?.[1]?.trim()) return quoted[1].trim().slice(0, 300)

  const trailing = /(?:con\s+)?(?:el\s+)?asunto\s+(?:es\s+)?(.+)$/i.exec(text)
  if (trailing?.[1]?.trim()) {
    const value = trailing[1].replace(/^["']|["']$/g, '').trim()
    if (value.length >= 3) return value.slice(0, 300)
  }

  return null
}

export function isEmailSubjectClarification(question: string): boolean {
  return EMAIL_SUBJECT_CLARIFICATION_RE.test(question.trim())
}

export function historyHasRecentEmailRequest(
  history: RagConversationTurn[],
): boolean {
  const recent = history.slice(-10)
  for (const turn of recent) {
    if (turn.role === 'user' && RECENT_EMAIL_USER_RE.test(turn.content)) {
      return true
    }
    if (turn.role === 'assistant' && RECENT_EMAIL_FAILURE_RE.test(turn.content)) {
      return true
    }
  }
  return false
}

export function isContinuingEmailThread(
  question: string,
  history: RagConversationTurn[],
): boolean {
  if (!historyHasRecentEmailRequest(history)) return false
  if (isEmailSubjectClarification(question)) return true
  if (extractEmailSubjectFromText(question) && /\basunto\b/i.test(question)) return true
  return false
}

export function matchesEmailPrepareIntent(question: string): boolean {
  return EMAIL_PREP_EXTENDED_RE.test(question.trim())
}

export function buildEmailQuestionWithContext(
  question: string,
  history: RagConversationTurn[],
): string {
  const recentUser = history
    .filter((turn) => turn.role === 'user')
    .slice(-4)
    .map((turn) => turn.content)
    .join('\n')
  const subject = extractEmailSubjectFromText(question)
  const parts = [recentUser, question].filter(Boolean)
  if (subject) {
    parts.push(`(Asunto del correo: ${subject})`)
  }
  return parts.join('\n')
}

export function inferDefaultEmailSubject(input: {
  question: string
  summariesText?: string
  emailBodyFallback?: string
}): string | undefined {
  const explicit = extractEmailSubjectFromText(input.question)
  if (explicit) return explicit
  if (input.summariesText?.trim() || input.emailBodyFallback?.trim()) {
    return 'Resumen de documentos'
  }
  return undefined
}
