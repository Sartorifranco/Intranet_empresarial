import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  type DocumentData,
} from 'firebase/firestore'
import { db } from './firebase'

const KUDOS_COLLECTION = 'kudos'

export type KudoBadge = 'Compañerismo' | 'Liderazgo' | 'Gran Esfuerzo'

export interface Kudo {
  id?: string
  recipient: string
  sender: string
  message: string
  badge: KudoBadge
  createdAt: Timestamp | Date
}

export interface CreateKudoInput {
  recipient: string
  sender: string
  message: string
  badge: KudoBadge
}

export const KUDO_BADGES: KudoBadge[] = ['Compañerismo', 'Liderazgo', 'Gran Esfuerzo']

export const KUDO_BADGE_EMOJI: Record<KudoBadge, string> = {
  Compañerismo: '🤝',
  Liderazgo: '⭐',
  'Gran Esfuerzo': '💪',
}

function toDate(value: Timestamp | Date): Date {
  return value instanceof Timestamp ? value.toDate() : value
}

function mapDocToKudo(id: string, data: DocumentData): Kudo {
  return {
    id,
    recipient: data.recipient ?? '',
    sender: data.sender ?? '',
    message: data.message ?? '',
    badge: (data.badge as KudoBadge) ?? 'Compañerismo',
    createdAt: data.createdAt ? toDate(data.createdAt as Timestamp) : new Date(),
  }
}

export async function getLatestKudos(): Promise<Kudo[]> {
  const kudosQuery = query(
    collection(db, KUDOS_COLLECTION),
    orderBy('createdAt', 'desc'),
    limit(10),
  )

  const snapshot = await getDocs(kudosQuery)

  if (snapshot.empty) {
    return []
  }

  return snapshot.docs
    .map((document) => {
      try {
        return mapDocToKudo(document.id, document.data())
      } catch (error) {
        console.error(`Error al mapear el kudo ${document.id}:`, error)
        return null
      }
    })
    .filter((kudo): kudo is Kudo => kudo !== null)
}

export async function createKudo(input: CreateKudoInput): Promise<string> {
  const docRef = await addDoc(collection(db, KUDOS_COLLECTION), {
    recipient: input.recipient.trim(),
    sender: input.sender.trim(),
    message: input.message.trim(),
    badge: input.badge,
    createdAt: serverTimestamp(),
  })

  return docRef.id
}

export interface KudoRankingEntry {
  recipient: string
  count: number
  badges: Record<KudoBadge, number>
}

function emptyBadgeCounts(): Record<KudoBadge, number> {
  return {
    Compañerismo: 0,
    Liderazgo: 0,
    'Gran Esfuerzo': 0,
  }
}

export async function getMonthlyKudosRanking(
  year: number = new Date().getFullYear(),
  month: number = new Date().getMonth() + 1,
): Promise<KudoRankingEntry[]> {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0)
  const end = new Date(year, month, 0, 23, 59, 59, 999)

  const kudosQuery = query(
    collection(db, KUDOS_COLLECTION),
    where('createdAt', '>=', Timestamp.fromDate(start)),
    where('createdAt', '<=', Timestamp.fromDate(end)),
    orderBy('createdAt', 'desc'),
  )

  const snapshot = await getDocs(kudosQuery)
  const totals = new Map<string, KudoRankingEntry>()

  snapshot.forEach((document) => {
    const data = document.data()
    const recipient = (data.recipient as string)?.trim()
    if (!recipient) return

    const badge = (data.badge as KudoBadge) ?? 'Compañerismo'
    const current = totals.get(recipient) ?? {
      recipient,
      count: 0,
      badges: emptyBadgeCounts(),
    }

    current.count += 1
    if (badge in current.badges) {
      current.badges[badge] += 1
    }

    totals.set(recipient, current)
  })

  return Array.from(totals.values()).sort((a, b) => b.count - a.count)
}

export function getMonthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  })
}
