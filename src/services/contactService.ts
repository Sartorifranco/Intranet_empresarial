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

const CONTACTS_COLLECTION = 'contacts'

export type Department = string

export interface EmployeeContact {
  id?: string
  name: string
  position: string
  department: Department
  email: string
  internalPhone: string
  birthdate?: string
}

function mapDocToEmployeeContact(id: string, data: DocumentData): EmployeeContact {
  return {
    id,
    name: data.name ?? '',
    position: data.position ?? '',
    department: (data.department as Department) ?? 'Administración',
    email: data.email ?? '',
    internalPhone: data.internalPhone ?? '',
    birthdate: data.birthdate ?? undefined,
  }
}

export async function getContacts(): Promise<EmployeeContact[]> {
  const contactsQuery = query(
    collection(db, CONTACTS_COLLECTION),
    orderBy('name', 'asc'),
  )

  const snapshot = await getDocs(contactsQuery)

  if (snapshot.empty) {
    return []
  }

  return snapshot.docs
    .map((document) => {
      try {
        return mapDocToEmployeeContact(document.id, document.data())
      } catch (error) {
        console.error(`Error al mapear el contacto ${document.id}:`, error)
        return null
      }
    })
    .filter((contact): contact is EmployeeContact => contact !== null)
}

export async function createContact(
  contact: Omit<EmployeeContact, 'id'>,
): Promise<string> {
  const docRef = await addDoc(collection(db, CONTACTS_COLLECTION), {
    name: contact.name,
    position: contact.position,
    department: contact.department,
    email: contact.email,
    internalPhone: contact.internalPhone,
    ...(contact.birthdate ? { birthdate: contact.birthdate } : {}),
  })

  return docRef.id
}

export async function deleteContact(id: string): Promise<void> {
  await deleteDoc(doc(db, CONTACTS_COLLECTION, id))
}

export async function updateContact(
  id: string,
  data: Partial<EmployeeContact>,
): Promise<void> {
  const { id: _id, ...fields } = data

  await updateDoc(doc(db, CONTACTS_COLLECTION, id), fields)
}
