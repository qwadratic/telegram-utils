/** One-off: send a document to Saved Messages (self chat). */
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { withSession } from './src/session/index.js'
const FILE = process.env.FILE!, CAPTION = process.env.CAPTION ?? ''
await withSession(async (tg) => {
  const me = await tg.getMe()
  const peer = await tg.resolvePeer(me.id)
  const msg = await tg.sendMedia(peer, {
    type: 'document',
    file: readFileSync(FILE),
    fileName: basename(FILE),
  }, { caption: CAPTION })
  console.log(JSON.stringify({ sent: true, id: msg.id }))
})
