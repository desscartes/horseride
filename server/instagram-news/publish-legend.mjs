import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { uploadImages, uploadVideo, publish, sha } from '../instagram-agent-io.mjs'

const id = 'legend-1996-bold-pilot'
const directory = `data/instagram/${id}`
const source = process.argv[2]
if (!source) throw Error('Provide rendered Reel directory')
await mkdir(directory, {recursive:true})
let manifest = null
try { manifest = JSON.parse(await readFile(`${directory}/manifest.json`, 'utf8')) }
catch (error) { if (error.code !== 'ENOENT') throw error }
if (!manifest) {
  await copyFile(resolve(source,'reel.mp4'), `${directory}/reel.mp4`)
  await copyFile(resolve(source,'frames/frame-0012.jpg'), `${directory}/image.jpg`)
  const caption = await readFile(resolve(source,'caption.txt'),'utf8')
  if (caption.length > 2200) throw Error('Caption exceeds Instagram limit')
  const [image] = await uploadImages(id,[`${directory}/image.jpg`])
  const video = await uploadVideo(id,`${directory}/reel.mp4`)
  manifest = {
    id, account:'ganyan_zekasi', instagramId:'17841441483231653', kind:'historical_reel',
    mediaType:'REELS', localImage:'image.jpg', imageSha256:image.sha256, imageUrl:image.url,
    localVideo:'reel.mp4', videoSha256:video.sha256, videoUrl:video.url,
    caption, sourceUrl:'https://www.tjk.org/TR/YarisSever/Query/Page/TumOnemliKosular?QueryParameter_OnemliKosuKodu=110',
    illustration:'AI-generated, clearly labeled as representative animation',
  }
  await writeFile(`${directory}/manifest.json`,JSON.stringify(manifest,null,2))
}
const current=JSON.parse(await readFile(`${directory}/manifest.json`,'utf8'))
if(sha(await readFile(`${directory}/reel.mp4`))!==current.videoSha256)throw Error('Reel changed after preparation')
await publish(id,'Prepare')
const result=await publish(id,'Publish')
console.log(result)
