import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore'
import { db } from './firebase'

const LINKS_COLLECTION = 'links'

export type LinkCategory = 'Herramientas IT' | 'Operaciones' | 'RRHH'

export interface UsefulLink {
  id?: string
  title: string
  url: string
  description: string
  category: LinkCategory
}

function mapDocToUsefulLink(id: string, data: DocumentData): UsefulLink {
  return {
    id,
    title: data.title ?? '',
    url: data.url ?? '',
    description: data.description ?? '',
    category: (data.category as LinkCategory) ?? 'Herramientas IT',
  }
}

export async function getLinks(): Promise<UsefulLink[]> {
  const linksQuery = query(
    collection(db, LINKS_COLLECTION),
    orderBy('category', 'asc'),
  )

  const snapshot = await getDocs(linksQuery)

  if (snapshot.empty) {
    return []
  }

  const links = snapshot.docs
    .map((document) => {
      try {
        return mapDocToUsefulLink(document.id, document.data())
      } catch (error) {
        console.error(`Error al mapear el enlace ${document.id}:`, error)
        return null
      }
    })
    .filter((link): link is UsefulLink => link !== null)

  return links.sort((a, b) => {
    const byCategory = a.category.localeCompare(b.category, 'es')
    return byCategory !== 0 ? byCategory : a.title.localeCompare(b.title, 'es')
  })
}

export async function createLink(link: Omit<UsefulLink, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(db, LINKS_COLLECTION), {
    title: link.title,
    url: link.url,
    description: link.description,
    category: link.category,
  })

  return docRef.id
}

export async function updateLink(
  id: string,
  link: Omit<UsefulLink, 'id'>,
): Promise<void> {
  await updateDoc(doc(db, LINKS_COLLECTION, id), {
    title: link.title.trim(),
    url: link.url.trim(),
    description: link.description.trim(),
    category: link.category,
  })
}

export async function deleteLink(id: string): Promise<void> {
  await deleteDoc(doc(db, LINKS_COLLECTION, id))
}
