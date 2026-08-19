import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore'
import { isContentExpired, toContentDate } from './contentExpiry'
import { db } from './firebase'

const POLLS_COLLECTION = 'polls'

export interface Poll {
  id?: string
  question: string
  options: string[]
  votes: number[]
  active: boolean
  createdAt: Timestamp | Date
  imageUrl?: string
  expiresAt?: Timestamp | Date
}

export interface PollInput {
  question: string
  options: string[]
  imageUrl?: string
  expiresAt?: Timestamp | Date | null
}

function toDate(value: Timestamp | Date): Date {
  return value instanceof Timestamp ? value.toDate() : value
}

function mapExpiresAt(data: DocumentData): Timestamp | Date | undefined {
  if (!data.expiresAt) return undefined
  return toDate(data.expiresAt as Timestamp)
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

function buildInitialVotes(optionCount: number): Record<string, number> {
  return Object.fromEntries(
    Array.from({ length: optionCount }, (_, i) => [String(i), 0]),
  )
}

function mapDocToPoll(id: string, data: DocumentData): Poll {
  const options: string[] = data.options ?? []

  return {
    id,
    question: data.question ?? '',
    options,
    votes: normalizeVotes(data, options.length),
    active: Boolean(data.active),
    createdAt: data.createdAt ? toDate(data.createdAt as Timestamp) : new Date(),
    imageUrl: data.imageUrl ?? undefined,
    expiresAt: mapExpiresAt(data),
  }
}

function pickActivePoll(polls: Poll[]): Poll | null {
  const activePolls = polls
    .filter((poll) => poll.active && !isContentExpired(poll.expiresAt))
    .sort((a, b) => toContentDate(b.createdAt).getTime() - toContentDate(a.createdAt).getTime())

  return activePolls[0] ?? null
}

function buildPollPayload(input: PollInput, votes: number[], isCreate = false): Record<string, unknown> {
  const options = input.options.map((option) => option.trim()).filter(Boolean)
  const payload: Record<string, unknown> = {
    question: input.question.trim(),
    options,
    votes: Object.fromEntries(votes.map((count, index) => [String(index), count])),
  }

  const trimmedImage = input.imageUrl?.trim()
  if (trimmedImage) {
    payload.imageUrl = trimmedImage
  } else if (!isCreate) {
    payload.imageUrl = deleteField()
  }

  if (input.expiresAt === null) {
    payload.expiresAt = deleteField()
  } else if (input.expiresAt) {
    payload.expiresAt =
      input.expiresAt instanceof Timestamp
        ? input.expiresAt
        : Timestamp.fromDate(input.expiresAt)
  } else if (!isCreate) {
    payload.expiresAt = deleteField()
  }

  return payload
}

export async function getActivePoll(): Promise<Poll | null> {
  const activeQuery = query(
    collection(db, POLLS_COLLECTION),
    where('active', '==', true),
  )

  const snapshot = await getDocs(activeQuery)

  if (snapshot.empty) {
    return null
  }

  const polls = snapshot.docs.map((document) =>
    mapDocToPoll(document.id, document.data()),
  )

  return pickActivePoll(polls)
}

export function subscribeActivePoll(
  onData: (poll: Poll | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const activeQuery = query(
    collection(db, POLLS_COLLECTION),
    where('active', '==', true),
  )

  return onSnapshot(
    activeQuery,
    (snapshot) => {
      if (snapshot.empty) {
        onData(null)
        return
      }

      const polls = snapshot.docs.map((document) =>
        mapDocToPoll(document.id, document.data()),
      )

      onData(pickActivePoll(polls))
    },
    (error) => {
      console.error('Error en suscripción de encuesta activa:', error)
      onError?.(error)
      onData(null)
    },
  )
}

export async function getPolls(): Promise<Poll[]> {
  const pollsQuery = query(
    collection(db, POLLS_COLLECTION),
    orderBy('createdAt', 'desc'),
  )

  const snapshot = await getDocs(pollsQuery)

  if (snapshot.empty) {
    return []
  }

  return snapshot.docs
    .map((document) => {
      try {
        return mapDocToPoll(document.id, document.data())
      } catch (error) {
        console.error(`Error al mapear la encuesta ${document.id}:`, error)
        return null
      }
    })
    .filter((poll): poll is Poll => poll !== null)
}

export async function createPoll(input: PollInput): Promise<string> {
  const options = input.options.map((option) => option.trim()).filter(Boolean)

  if (options.length < 2) {
    throw new Error('La encuesta debe tener al menos 2 opciones')
  }

  const payload = buildPollPayload(
    input,
    Object.values(buildInitialVotes(options.length)),
    true,
  )

  const docRef = await addDoc(collection(db, POLLS_COLLECTION), {
    ...payload,
    active: false,
    createdAt: serverTimestamp(),
  })

  return docRef.id
}

export async function updatePoll(id: string, input: PollInput): Promise<void> {
  const options = input.options.map((option) => option.trim()).filter(Boolean)

  if (options.length < 2) {
    throw new Error('La encuesta debe tener al menos 2 opciones')
  }

  const snapshot = await getDoc(doc(db, POLLS_COLLECTION, id))
  if (!snapshot.exists()) {
    throw new Error('Encuesta no encontrada')
  }

  const current = mapDocToPoll(id, snapshot.data())
  const votes = Array.from({ length: options.length }, (_, index) => current.votes[index] ?? 0)

  await updateDoc(doc(db, POLLS_COLLECTION, id), buildPollPayload(input, votes))
}

export async function deletePoll(id: string): Promise<void> {
  await deleteDoc(doc(db, POLLS_COLLECTION, id))
}

export async function activatePoll(id: string): Promise<void> {
  const pollSnapshot = await getDoc(doc(db, POLLS_COLLECTION, id))
  if (!pollSnapshot.exists()) {
    throw new Error('Encuesta no encontrada')
  }

  const poll = mapDocToPoll(id, pollSnapshot.data())
  if (isContentExpired(poll.expiresAt)) {
    throw new Error('No se puede activar una encuesta vencida')
  }

  const activeQuery = query(
    collection(db, POLLS_COLLECTION),
    where('active', '==', true),
  )

  const snapshot = await getDocs(activeQuery)
  const batch = writeBatch(db)

  snapshot.docs.forEach((document) => {
    if (document.id !== id) {
      batch.update(document.ref, { active: false })
    }
  })

  batch.update(doc(db, POLLS_COLLECTION, id), { active: true })
  await batch.commit()
}

export async function votePoll(pollId: string, optionIndex: number): Promise<void> {
  await updateDoc(doc(db, POLLS_COLLECTION, pollId), {
    [`votes.${optionIndex}`]: increment(1),
  })
}

export function getVotePercentages(poll: Poll): number[] {
  const total = poll.votes.reduce((sum, count) => sum + count, 0)

  if (total === 0) {
    return poll.options.map(() => 0)
  }

  return poll.votes.map((count) => Math.round((count / total) * 100))
}

export { datetimeLocalToTimestamp, formatExpiryLabel, isContentExpired, timestampToDatetimeLocal } from './contentExpiry'
