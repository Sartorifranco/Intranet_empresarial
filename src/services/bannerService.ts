import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore'
import { db } from './firebase'

const BANNERS_COLLECTION = 'banners'

export interface Banner {
  id?: string
  title: string
  imageUrl: string
  active: boolean
  createdAt: Timestamp | Date
}

function toDate(value: Timestamp | Date): Date {
  return value instanceof Timestamp ? value.toDate() : value
}

function mapDocToBanner(id: string, data: DocumentData): Banner {
  const createdAt = data.createdAt
    ? toDate(data.createdAt as Timestamp)
    : new Date()

  return {
    id,
    title: data.title ?? '',
    imageUrl: data.imageUrl ?? '',
    active: data.active === true,
    createdAt,
  }
}

export async function getBanners(): Promise<Banner[]> {
  const bannersQuery = query(
    collection(db, BANNERS_COLLECTION),
    orderBy('createdAt', 'desc'),
  )

  const snapshot = await getDocs(bannersQuery)

  if (snapshot.empty) {
    return []
  }

  return snapshot.docs.map((document) =>
    mapDocToBanner(document.id, document.data()),
  )
}

export async function getActiveBanner(): Promise<Banner | null> {
  const activeQuery = query(
    collection(db, BANNERS_COLLECTION),
    where('active', '==', true),
    limit(1),
  )

  const snapshot = await getDocs(activeQuery)

  if (snapshot.empty) {
    return null
  }

  const document = snapshot.docs[0]
  return mapDocToBanner(document.id, document.data())
}

async function deactivateAllBanners(): Promise<void> {
  const activeQuery = query(
    collection(db, BANNERS_COLLECTION),
    where('active', '==', true),
  )

  const snapshot = await getDocs(activeQuery)

  if (snapshot.empty) {
    return
  }

  const batch = writeBatch(db)
  snapshot.docs.forEach((document) => {
    batch.update(document.ref, { active: false })
  })
  await batch.commit()
}

export async function createBanner(
  banner: Pick<Banner, 'title' | 'imageUrl' | 'active'>,
): Promise<string> {
  if (banner.active) {
    await deactivateAllBanners()
  }

  const docRef = await addDoc(collection(db, BANNERS_COLLECTION), {
    title: banner.title.trim(),
    imageUrl: banner.imageUrl.trim(),
    active: banner.active,
    createdAt: serverTimestamp(),
  })

  return docRef.id
}

export async function updateBanner(
  id: string,
  updates: Pick<Banner, 'title' | 'imageUrl' | 'active'>,
): Promise<void> {
  if (updates.active) {
    await deactivateAllBanners()
  }

  await updateDoc(doc(db, BANNERS_COLLECTION, id), {
    title: updates.title.trim(),
    imageUrl: updates.imageUrl.trim(),
    active: updates.active,
  })
}

export async function setBannerActive(id: string, active: boolean): Promise<void> {
  if (active) {
    await deactivateAllBanners()
    await updateDoc(doc(db, BANNERS_COLLECTION, id), { active: true })
    return
  }

  await updateDoc(doc(db, BANNERS_COLLECTION, id), { active: false })
}

export async function deleteBanner(id: string): Promise<void> {
  await deleteDoc(doc(db, BANNERS_COLLECTION, id))
}
