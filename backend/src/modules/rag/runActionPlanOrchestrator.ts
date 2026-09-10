import { listCalendarEventsTool } from '../assistant-actions/calendarReadTools.js'
import { todayInTimeZone } from '../assistant-actions/calendarDateTime.js'
import type { ActionContext, CalendarEventCatalogEntry } from './actionPlanTypes.js'
import { inferCalendarCancelRange } from './assistantIntent.js'
import { extractActionPlan, ActionPlanValidationError } from './extractActionPlan.js'
import {
  buildActionPlanAnswer,
  prepareActionBatch,
  preparationFailuresFromBatch,
} from './prepareActionBatch.js'
import type { RagToolContext } from './executeRagTool.js'
import type { RagConversationTurn } from './runRagAssistant.js'
import type { QuestionIntent } from './assistantIntent.js'
import { buildEmailQuestionWithContext, isContinuingEmailThread } from './emailConversationContext.js'
import {
  extractPendingEmailDraftFromHistory,
  isEmailDraftFollowUpQuestion,
} from './emailDraftFromHistory.js'
import {
  formatContactsDirectoryForPrompt,
  loadIntranetContacts,
  lookupContactEmailByName,
  type IntranetContact,
} from './intranetContacts.js'
import type { ActionPlan, PlannedEmailAction } from './actionPlanTypes.js'

const PREPARED_ACTIONS_STUB_RE =
  /^Prepar[eé]\s+\*\*\d+\s+de\s+\d+\*\*\s+acciones|Revis[aá]\s+cada\s+tarjeta/i

function extractPreviousAssistantContent(
  history: RagConversationTurn[],
  emailBodyFallback?: string,
): string | undefined {
  const lastAssistant = [...history].reverse().find((turn) => turn.role === 'assistant')
  const content = lastAssistant?.content?.trim()
  if (content && content.length >= 10 && !PREPARED_ACTIONS_STUB_RE.test(content)) {
    return content
  }
  const fallback = emailBodyFallback?.trim()
  return fallback && fallback.length >= 10 ? fallback : undefined
}

export function extractSummaryBodyFromHistory(history: RagConversationTurn[]): string | undefined {
  const assistantMessages = history
    .filter((turn) => turn.role === 'assistant')
    .map((turn) => turn.content)
    .reverse()

  for (const content of assistantMessages) {
    if (content.length > 200) return content
  }
  return assistantMessages[0]
}

function buildActionContext(input: {
  history: RagConversationTurn[]
  summariesText?: string
  organizerEmail?: string
  pendingEmailDraft?: ActionContext['pendingEmailDraft']
  emailBodyFallback?: string
  contactsDirectoryText?: string
}): ActionContext {
  return {
    referenceDate: todayInTimeZone(),
    summariesText: input.summariesText,
    emailBodyFallback: input.emailBodyFallback,
    pendingEmailDraft: input.pendingEmailDraft,
    contactsDirectoryText: input.contactsDirectoryText,
    previousAssistantText: extractPreviousAssistantContent(
      input.history,
      input.emailBodyFallback,
    ),
    organizerEmail: input.organizerEmail?.trim().toLowerCase(),
  }
}

function extractPersonNameFromEmailFollowUp(question: string): string | null {
  const patterns = [
    /(?:agreg(?:ar|a|á)|sum(?:ar|a|á)|inclu(?:ir|i|í)|a[nñ]ad(?:ir|i|í)|pon(?:er|e|é)|met(?:er|e|é))\s+(?:a\s+)?(.+?)\s+(?:al|en el|del)\s+(?:correo|mail|e-?mail|mensaje|borrador)/i,
    /(?:agreg(?:ar|a|á)|sum(?:ar|a|á)|inclu(?:ir|i|í)|a[nñ]ad(?:ir|i|í))\s+(?:a\s+)?(.+?)\s*$/i,
  ]
  for (const pattern of patterns) {
    const match = pattern.exec(question.trim())
    const name = match?.[1]?.trim()
    if (name && name.length >= 3) return name.replace(/[?.!]+$/, '').trim()
  }
  return null
}

function mergeEmailDraftFollowUp(
  plan: ActionPlan,
  question: string,
  draft: ActionContext['pendingEmailDraft'],
  contacts: IntranetContact[],
): ActionPlan {
  if (!draft || !isEmailDraftFollowUpQuestion(question)) return plan

  const nameToAdd = extractPersonNameFromEmailFollowUp(question)
  let extraEmail: string | null = null
  if (nameToAdd && contacts.length > 0) {
    const lookup = lookupContactEmailByName(nameToAdd, contacts)
    if (lookup.status === 'found') extraEmail = lookup.email
  }

  const actions = plan.actions.map((action) => {
    if (action.kind !== 'email') return action
    const emailAction = action as PlannedEmailAction
    const to = [...emailAction.to]
    const cc = [...(emailAction.cc ?? [])]
    for (const existing of draft.to) {
      if (!to.includes(existing)) to.push(existing)
    }
    for (const existing of draft.cc) {
      if (!cc.includes(existing)) cc.push(existing)
    }
    if (extraEmail && !to.includes(extraEmail) && !cc.includes(extraEmail)) {
      to.push(extraEmail)
    }
    const subject = emailAction.subject.trim() || draft.subject
    return {
      ...emailAction,
      to,
      cc: cc.length > 0 ? cc : undefined,
      subject,
      bodySource: { type: 'reuse_draft' as const },
    }
  })

  return { ...plan, actions }
}

export function wantsActionPlan(intent: QuestionIntent): boolean {
  return intent.wantsEmail || intent.wantsCalendar || intent.wantsCalendarCancel
}

function mapEventsCatalog(result: Record<string, unknown>): CalendarEventCatalogEntry[] {
  const events = Array.isArray(result.events)
    ? (result.events as Array<{
        eventId?: string | null
        title?: string
        start?: string
        end?: string | null
        attendees?: string[]
        allDay?: boolean
      }>)
    : []
  return events
    .filter((event): event is typeof event & { eventId: string } => Boolean(event.eventId?.trim()))
    .map((event) => ({
      eventId: event.eventId!.trim(),
      title: event.title?.trim() || '(Sin título)',
      start: event.start?.trim() || '',
      end: event.end?.trim() ?? null,
      attendees: Array.isArray(event.attendees) ? event.attendees : [],
      allDay: event.allDay === true,
    }))
}

export async function runActionPlanOrchestrator(input: {
  question: string
  history: RagConversationTurn[]
  intent: QuestionIntent
  toolCtx: RagToolContext
  toolsUsed: string[]
  summariesText?: string
  includeSummariesIntro?: boolean
}): Promise<{
  handled: boolean
  answer: string
  preparationFailures: Array<{ ref: string; message: string; errorCode: string }>
  deferredActionRefs: string[]
}> {
  if (!wantsActionPlan(input.intent)) {
    return { handled: false, answer: '', preparationFailures: [], deferredActionRefs: [] }
  }

  const pendingEmailDraft = extractPendingEmailDraftFromHistory(input.history)
  const emailBodyFallback = extractSummaryBodyFromHistory(input.history)
  let intranetContacts: IntranetContact[] = []
  if (input.intent.wantsEmail) {
    try {
      intranetContacts = await loadIntranetContacts()
    } catch {
      intranetContacts = []
    }
  }

  let actionContext = buildActionContext({
    history: input.history,
    summariesText: input.summariesText,
    organizerEmail: input.toolCtx.searchSubject,
    pendingEmailDraft,
    emailBodyFallback,
    contactsDirectoryText:
      intranetContacts.length > 0
        ? formatContactsDirectoryForPrompt(intranetContacts)
        : undefined,
  })

  if (input.intent.wantsCalendarCancel) {
    input.toolsUsed.push('orchestrated_list_calendar_for_cancel')
    const range = inferCalendarCancelRange(input.question, input.history)
    const calendarResult = await listCalendarEventsTool({
      impersonateAs: input.toolCtx.searchSubject,
      args: {
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
      },
    })
    if (typeof calendarResult.error === 'string') {
      return {
        handled: true,
        answer:
          typeof calendarResult.message === 'string'
            ? calendarResult.message
            : 'No pude consultar tu calendario para preparar la cancelación.',
        preparationFailures: [],
        deferredActionRefs: [],
      }
    }
    const catalog = mapEventsCatalog(calendarResult)
    if (catalog.length === 0) {
      return {
        handled: true,
        answer: 'No encontré eventos en tu agenda para ese período.',
        preparationFailures: [],
        deferredActionRefs: [],
      }
    }
    actionContext = {
      ...actionContext,
      calendarEventsCatalog: catalog,
    }
  }

  input.toolsUsed.push('orchestrated_extract_action_plan')

  let extracted
  try {
    const planQuestion = isContinuingEmailThread(input.question, input.history)
      ? buildEmailQuestionWithContext(input.question, input.history)
      : input.question

    extracted = await extractActionPlan({
      question: planQuestion,
      history: input.history,
      context: actionContext,
      usageMeter: input.toolCtx.usageMeter,
      intranetContacts,
    })
  } catch (err) {
    if (err instanceof ActionPlanValidationError) {
      return {
        handled: true,
        answer: err.message,
        preparationFailures: [],
        deferredActionRefs: [],
      }
    }
    if (input.intent.wantsCalendarCancel) {
      return {
        handled: true,
        answer:
          'No pude preparar la cancelación automáticamente. Pedime que liste tus eventos y decime cuáles cancelar (por hora o título).',
        preparationFailures: [],
        deferredActionRefs: [],
      }
    }
    return { handled: false, answer: '', preparationFailures: [], deferredActionRefs: [] }
  }

  let plan = mergeEmailDraftFollowUp(
    extracted.plan,
    input.question,
    pendingEmailDraft,
    intranetContacts,
  )
  const validationFailures = extracted.validationFailures.map((failure) => ({
    ref: failure.ref,
    message: failure.message,
    errorCode: failure.errorCode,
  }))

  if (plan.actions.length === 0) {
    const emptyAnswer =
      validationFailures.length > 0
        ? buildActionPlanAnswer({
            plan: { actions: [], assumptions: plan.assumptions },
            batch: { results: [], deferredRefs: [] },
          }) +
          '\n\n' +
          validationFailures.map((failure) => `- ${failure.message}`).join('\n')
        : input.intent.wantsCalendarCancel
          ? 'No identifiqué eventos concretos para cancelar en tu agenda. Decime la hora o el título de cada reunión.'
          : ''
    return {
      handled: validationFailures.length > 0 || input.intent.wantsCalendarCancel,
      answer: emptyAnswer,
      preparationFailures: validationFailures,
      deferredActionRefs: [],
    }
  }

  const batch = await prepareActionBatch({
    plan,
    ctx: input.toolCtx,
    actionContext,
    toolsUsed: input.toolsUsed,
  })

  const preparationFailures = [
    ...validationFailures,
    ...preparationFailuresFromBatch(batch),
  ]
  const okCount = batch.results.filter((result) => result.ok).length

  if (okCount === 0 && preparationFailures.length === 0 && batch.deferredRefs.length === 0) {
    return { handled: false, answer: '', preparationFailures: [], deferredActionRefs: [] }
  }

  return {
    handled: true,
    answer: buildActionPlanAnswer({
      plan,
      batch,
      includeSummariesIntro: input.includeSummariesIntro,
      validationFailures,
    }),
    preparationFailures,
    deferredActionRefs: batch.deferredRefs,
  }
}
