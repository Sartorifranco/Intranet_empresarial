import { initAdmin, loadTestEnv } from './get-test-token.mjs'
import { grantBoardAccess } from '../lib/modules/boards/boardAccess.js'

loadTestEnv()
initAdmin()

try {
  const result = await grantBoardAccess({
    boardFolderId: '140_xtWc8wk4hl7Tfy9aU-VRm41AGjzv9',
    boardName: 'compras',
    grantee: {
      uid: 'ah2KwacRBWcqz5xTXJpUGYbndey1',
      email: 'implementaciones.it@bacarsa.com.ar',
      displayName: 'Implementaciones IT',
    },
    actor: {
      uid: 'hHDlXZ5vAGOQWrvPqULrSfrvvO63',
      email: 'admin@bacarsa.com.ar',
      displayName: 'Admin',
      managedAreaIds: [],
    },
  })
  console.log('OK', JSON.stringify(result))
} catch (err) {
  console.error('ERR', err)
  process.exit(1)
}
