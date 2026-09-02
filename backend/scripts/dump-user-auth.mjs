import { getAuth } from 'firebase-admin/auth'
import { getAdminDb, initAdmin, loadTestEnv } from './get-test-token.mjs'

loadTestEnv()
initAdmin()
const uid = process.argv[2] || 'ah2KwacRBWcqz5xTXJpUGYbndey1'
const authUser = await getAuth().getUser(uid)
const profile = await getAdminDb().collection('users').doc(uid).get()
console.log('Auth email:', authUser.email)
console.log('Firestore email:', profile.get('email'))
console.log('role:', profile.get('role'))
