import { getDrive } from '../lib/lib/google/driveClient.js'
import { initAdmin, loadTestEnv } from './get-test-token.mjs'

loadTestEnv()
initAdmin()
const driveId = process.env.DRIVE_ID
const drive = await getDrive()
const r = await drive.files.list({
  q: `'${driveId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
  fields: 'files(id,name)',
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
  pageSize: 100,
  orderBy: 'name_natural',
})
for (const f of r.data.files ?? []) {
  console.log(`${f.name}\t${f.id}`)
}
