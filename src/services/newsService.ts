import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore'
import { isContentExpired } from './contentExpiry'
import { db } from './firebase'

const NEWS_COLLECTION = 'news'

export type NewsCategory = 'General' | 'Recursos Humanos' | 'Sistemas'

export interface NewsPost {
  id?: string
  title: string
  content: string
  author: string
  createdAt: Timestamp | Date
  category: NewsCategory
  imageUrl?: string
  expiresAt?: Timestamp | Date
}

export interface NewsInput {
  title: string
  content: string
  author: string
  category: NewsCategory
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

function mapDocToNewsPost(id: string, data: DocumentData): NewsPost {
  const createdAt = data.createdAt
    ? toDate(data.createdAt as Timestamp)
    : new Date()

  return {
    id,
    title: data.title ?? '',
    content: data.content ?? '',
    author: data.author ?? 'Desconocido',
    category: (data.category as NewsCategory) ?? 'General',
    createdAt,
    imageUrl: data.imageUrl ?? undefined,
    expiresAt: mapExpiresAt(data),
  }
}

function buildNewsPayload(news: NewsInput, includeCreatedAt = false): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    title: news.title.trim(),
    content: news.content.trim(),
    author: news.author,
    category: news.category,
  }

  if (includeCreatedAt) {
    payload.createdAt = serverTimestamp()
  }

  const trimmedImage = news.imageUrl?.trim()
  if (trimmedImage) {
    payload.imageUrl = trimmedImage
  } else if (!includeCreatedAt) {
    payload.imageUrl = deleteField()
  }

  if (news.expiresAt === null) {
    payload.expiresAt = deleteField()
  } else if (news.expiresAt) {
    payload.expiresAt =
      news.expiresAt instanceof Timestamp
        ? news.expiresAt
        : Timestamp.fromDate(news.expiresAt)
  } else if (!includeCreatedAt) {
    payload.expiresAt = deleteField()
  }

  return payload
}

export async function getNews(options?: { includeExpired?: boolean }): Promise<NewsPost[]> {
  const includeExpired = options?.includeExpired ?? false

  const newsQuery = query(
    collection(db, NEWS_COLLECTION),
    orderBy('createdAt', 'desc'),
  )

  const snapshot = await getDocs(newsQuery)

  if (snapshot.empty) {
    return []
  }

  const posts = snapshot.docs
    .map((document) => {
      try {
        return mapDocToNewsPost(document.id, document.data())
      } catch (error) {
        console.error(`Error al mapear la noticia ${document.id}:`, error)
        return null
      }
    })
    .filter((post): post is NewsPost => post !== null)

  if (includeExpired) {
    return posts
  }

  return posts.filter((post) => !isContentExpired(post.expiresAt))
}

export async function createNews(news: NewsInput): Promise<string> {
  const payload = buildNewsPayload(news, true)
  const docRef = await addDoc(collection(db, NEWS_COLLECTION), payload)
  return docRef.id
}

export async function updateNews(id: string, news: NewsInput): Promise<void> {
  await updateDoc(doc(db, NEWS_COLLECTION, id), buildNewsPayload(news))
}

export async function deleteNews(id: string): Promise<void> {
  await deleteDoc(doc(db, NEWS_COLLECTION, id))
}

export { datetimeLocalToTimestamp, formatExpiryLabel, timestampToDatetimeLocal } from './contentExpiry'
