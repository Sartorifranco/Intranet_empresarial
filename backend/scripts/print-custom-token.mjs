import { getAuth } from 'firebase-admin/auth'
import { getTestIdToken, initAdmin, loadTestEnv } from './get-test-token.mjs'

loadTestEnv()
initAdmin()
const user = await getTestIdToken()
const customToken = await getAuth().createCustomToken(user.uid)
console.log(JSON.stringify({ email: user.email, customToken }))
