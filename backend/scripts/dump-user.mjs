import { getAdminDb, initAdmin, loadTestEnv } from './get-test-token.mjs'

loadTestEnv()
initAdmin()
const db = getAdminDb()
const uid = process.argv[2] || 'ah2KwacRBWcqz5xTXJpUGYbndey1'
const snap = await db.collection('users').doc(uid).get()
console.log(JSON.stringify(snap.data(), null, 2))
