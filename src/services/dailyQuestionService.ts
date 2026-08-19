import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore'
import { addDays, getTodayDateKey } from '../utils/weekUtils'
import { db } from './firebase'

const DAILY_QUESTIONS_COLLECTION = 'dailyQuestions'

export interface DailyQuestion {
  dateKey: string
  question: string
  options: string[]
  votes: number[]
  createdAt: Timestamp | Date
}

export interface DailyQuestionInput {
  question: string
  options: string[]
}

function toDate(value: Timestamp | Date): Date {
  return value instanceof Timestamp ? value.toDate() : value
}

function normalizeVotes(data: DocumentData, optionCount: number): number[] {
  const raw = data.votes

  if (Array.isArray(raw)) {
    return Array.from({ length: optionCount }, (_, i) => Number(raw[i] ?? 0))
  }

  if (raw && typeof raw === 'object') {
    return Array.from({ length: optionCount }, (_, i) =>
      Number((raw as Record<string, number>)[String(i)] ?? 0),
    )
  }

  return Array.from({ length: optionCount }, () => 0)
}

function mapDocToDailyQuestion(dateKey: string, data: DocumentData): DailyQuestion {
  const options: string[] = data.options ?? []

  return {
    dateKey,
    question: data.question ?? '',
    options,
    votes: normalizeVotes(data, options.length),
    createdAt: data.createdAt ? toDate(data.createdAt as Timestamp) : new Date(),
  }
}

function buildInitialVotes(optionCount: number): Record<string, number> {
  return Object.fromEntries(
    Array.from({ length: optionCount }, (_, i) => [String(i), 0]),
  )
}

export function getVotePercentages(question: DailyQuestion): number[] {
  const total = question.votes.reduce((sum, count) => sum + count, 0)

  if (total === 0) {
    return question.options.map(() => 0)
  }

  return question.votes.map((count) => Math.round((count / total) * 100))
}

export async function getDailyQuestion(dateKey: string): Promise<DailyQuestion | null> {
  const snapshot = await getDoc(doc(db, DAILY_QUESTIONS_COLLECTION, dateKey))

  if (!snapshot.exists()) {
    return null
  }

  return mapDocToDailyQuestion(dateKey, snapshot.data())
}

export function subscribeDailyQuestion(
  dateKey: string,
  onData: (question: DailyQuestion | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, DAILY_QUESTIONS_COLLECTION, dateKey),
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(null)
        return
      }
      onData(mapDocToDailyQuestion(dateKey, snapshot.data()))
    },
    (error) => {
      console.error('Error en suscripción de pregunta del día:', error)
      onError?.(error)
      onData(null)
    },
  )
}

export async function getDailyQuestions(): Promise<DailyQuestion[]> {
  const snapshot = await getDocs(collection(db, DAILY_QUESTIONS_COLLECTION))

  if (snapshot.empty) {
    return []
  }

  return snapshot.docs
    .map((document) => {
      try {
        return mapDocToDailyQuestion(document.id, document.data())
      } catch (error) {
        console.error(`Error al mapear pregunta ${document.id}:`, error)
        return null
      }
    })
    .filter((question): question is DailyQuestion => question !== null)
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
}

export async function saveDailyQuestion(
  dateKey: string,
  input: DailyQuestionInput,
): Promise<void> {
  const options = input.options.map((option) => option.trim()).filter(Boolean)

  if (options.length < 2) {
    throw new Error('La pregunta debe tener al menos 2 opciones')
  }

  const existing = await getDailyQuestion(dateKey)
  const votes = existing
    ? Array.from({ length: options.length }, (_, index) => existing.votes[index] ?? 0)
    : Object.values(buildInitialVotes(options.length))

  const payload: Record<string, unknown> = {
    question: input.question.trim(),
    options,
    votes: Object.fromEntries(votes.map((count, index) => [String(index), count])),
  }

  if (!existing) {
    payload.createdAt = serverTimestamp()
  }

  await setDoc(doc(db, DAILY_QUESTIONS_COLLECTION, dateKey), payload, { merge: true })
}

export async function deleteDailyQuestion(dateKey: string): Promise<void> {
  await deleteDoc(doc(db, DAILY_QUESTIONS_COLLECTION, dateKey))
}

export async function voteDailyQuestion(dateKey: string, optionIndex: number): Promise<void> {
  await updateDoc(doc(db, DAILY_QUESTIONS_COLLECTION, dateKey), {
    [`votes.${optionIndex}`]: increment(1),
  })
}

export function getYesterdayDateKey(): string {
  return addDays(getTodayDateKey(), -1)
}
