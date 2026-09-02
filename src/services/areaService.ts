import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
  type DocumentData,
} from 'firebase/firestore'
import { db } from './firebase'

const AREAS_COLLECTION = 'folders'

export interface GoverningArea {
  id: string
  name: string
  governingAreaId: string
  parentFolderId: null
  allowedUsers: string[]
  createdAt: Timestamp | Date
}

function toDate(value: Timestamp | Date): Date {
  return value instanceof Timestamp ? value.toDate() : value
}

function mapRootArea(id: string, data: DocumentData): GoverningArea {
  const governingAreaId =
    typeof data.governingAreaId === 'string' && data.governingAreaId.length > 0
      ? data.governingAreaId
      : id
  const allowedUsers = Array.isArray(data.allowedUsers)
    ? data.allowedUsers.filter((uid): uid is string => typeof uid === 'string' && uid.length > 0)
    : []

  return {
    id,
    name: typeof data.name === 'string' ? data.name : id,
    governingAreaId,
    parentFolderId: null,
    allowedUsers,
    createdAt: data.createdAt ? toDate(data.createdAt as Timestamp) : new Date(),
  }
}

/** Catálogo de áreas gobernantes (documentos raíz en `folders/`). */
export async function listRootAreas(): Promise<GoverningArea[]> {
  const rootsQuery = query(collection(db, AREAS_COLLECTION), where('parentFolderId', '==', null))
  const snapshot = await getDocs(rootsQuery)
  const areas = snapshot.docs.map((docSnap) => mapRootArea(docSnap.id, docSnap.data()))
  areas.sort((a, b) => a.name.localeCompare(b.name, 'es'))
  return areas
}

export function isSharedAreasFolder(name: string): boolean {
  return name.trim().toLowerCase() === 'compartido entre áreas'
}

/** Áreas raíz excluyendo el bucket transversal "Compartido entre áreas". */
export async function listAssignableRootAreas(): Promise<GoverningArea[]> {
  const areas = await listRootAreas()
  return areas.filter((area) => !isSharedAreasFolder(area.name))
}
