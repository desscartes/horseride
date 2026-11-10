import { readFile, writeFile, access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { uploadImages, publish, sha } from '../instagram-agent-io.mjs'

process.chdir(fileURLToPath(new URL('../../', import.meta.url)))
const id = 'cumhuriyet-2026-10-29'
const directory = `data/instagram/${id}`
const imagePath = `${directory}/image.jpg`
const captionPath = `${directory}/caption.txt`
const approvedImageSha = 'df25cf8334b25a49d2411e0af7ade8805a2288c873e3c505bbf134acab9e5854'
const approvedCaptionFileSha = 'd89fa1618f6e1115d7cf21dbc00e4c66501258a0debf3cf51e0e447cbd5d6dbf'
const local = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
if (local.slice(0, 10) !== '2026-10-29' || local.slice(11, 16) < '09:00') throw Error(`Not due on 29 October after 09:00 TSİ: ${local}`)

const image = await readFile(imagePath)
const captionFile = await readFile(captionPath)
if (sha(image) !== approvedImageSha || sha(captionFile) !== approvedCaptionFileSha) throw Error('Approved image or caption changed; publication stopped')
const caption = captionFile.toString('utf8').trimEnd()
if (caption.length > 2200) throw Error('Caption exceeds Instagram limit')

try {
  const ledger = JSON.parse((await readFile(`${directory}/publication.json`, 'utf8')).replace(/^\uFEFF/, ''))
  if (ledger.status === 'published_verified' && ledger.permalink) {
    console.log(JSON.stringify({ status: 'already_published', permalink: ledger.permalink }))
    process.exit(0)
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}

let manifest
try {
  manifest = JSON.parse((await readFile(`${directory}/manifest.json`, 'utf8')).replace(/^\uFEFF/, ''))
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}
if (!manifest) {
  const [uploaded] = await uploadImages(id, [imagePath])
  manifest = {
    id,
    account: 'ganyan_zekasi',
    instagramId: '17841441483231653',
    date: '2026-10-29',
    kind: 'republic_day_commemoration',
    localImage: 'image.jpg',
    imageSha256: uploaded.sha256,
    imageUrl: uploaded.url,
    caption,
    altText: '29 Ekim Cumhuriyet Bayramı illüstrasyonu: Mustafa Kemal Atatürk portresi, Türk bayrağı ve yarış atı. 1923 Cumhuriyetin ilanı, 1927 ilk Gazi Koşusu.',
    sourceUrls: ['https://atam.gov.tr/cumhuriyetin-ilani/', 'https://gazi.tjk.org/History'],
  }
  await writeFile(`${directory}/manifest.json`, JSON.stringify(manifest, null, 2), { flag: 'wx' })
}
if (manifest.id !== id || manifest.imageSha256 !== approvedImageSha || manifest.caption !== caption) throw Error('Manifest does not match approved post')
await access(`${directory}/manifest.json`)
let ready = false
for (let attempt = 0; attempt < 8; attempt++) {
  const preparation = JSON.parse(await publish(id, 'Prepare'))
  if (preparation.status === 'ready' || preparation.status === 'published_verified') { ready = true; break }
  await new Promise(resolve => setTimeout(resolve, 3000))
}
if (!ready) throw Error('Instagram media container not ready; scheduler may retry')
const result = JSON.parse(await publish(id, 'Publish'))
if (result.status !== 'published_verified' || !result.permalink) throw Error('Instagram publish outcome not verified')
console.log(JSON.stringify({ status: result.status, permalink: result.permalink }))
