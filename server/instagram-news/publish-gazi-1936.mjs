import {readFile,writeFile,mkdir,copyFile,open,unlink,readdir} from 'node:fs/promises'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {isProcessRunning} from '../process-liveness.mjs'
import {localDay} from '../maintenance-policy.mjs'
import {readPublicationCadence} from './cadence.mjs'
import {uploadImages,uploadVideo,publish,sha} from '../instagram-agent-io.mjs'

process.chdir(fileURLToPath(new URL('../../',import.meta.url)))
const id='legend-1936-silem',day=localDay(),root='data/instagram',directory=root+'/'+id
const source=resolve(process.argv[2]||'')
if(!process.argv[2])throw Error('Rendered Reel directory required')
const json=async path=>JSON.parse((await readFile(path,'utf8')).replace(/^\uFEFF/,''))
const config=await json(root+'/agent-config.json')
if(config.enabled!==true||config.mode!=='editorial_news')throw Error('Editorial publishing is not enabled')
let existing=null
try{existing=await json(directory+'/publication.json')}catch(error){if(error.code!=='ENOENT')throw error}
if(existing?.status==='published_verified'){console.log(JSON.stringify({status:'already_published',url:existing.permalink}));process.exit(0)}
if(existing?.mediaId||existing?.status==='publishing_unknown')throw Error('Previous publication requires reconciliation')
const lock=root+'/agent.lock'
for(let attempt=0;attempt<36;attempt++){
 let owner=null
 try{owner=await json(lock)}catch(error){if(error.code!=='ENOENT')throw error}
 if(!owner)break
 if(!isProcessRunning(owner.pid)){await unlink(lock);break}
 if(attempt===35)throw Error('Instagram agent stayed busy for three minutes')
 await new Promise(resolve=>setTimeout(resolve,5000))
}
const handle=await open(lock,'wx')
await handle.writeFile(JSON.stringify({pid:process.pid,at:new Date().toISOString(),manualHistoricalReel:id}))
await handle.close()
try{
 const published=[]
 for(const name of await readdir(root))try{
  const manifest=await json(root+'/'+name+'/manifest.json')
  if(manifest.date!==day)continue
  const entry=await json(root+'/'+name+'/publication.json')
  if(entry.status==='published_verified')published.push(entry)
 }catch(error){if(error.code!=='ENOENT'&&error.code!=='ENOTDIR')throw error}
 if(published.length>=Number(config.maxFeedPostsPerDay||8))throw Error('Daily feed limit reached')
 const cadence=await readPublicationCadence(root,day,new Date().toISOString(),config)
 if(!cadence.due)throw Error('Publication cadence: '+cadence.reason)
 await mkdir(directory,{recursive:true})
 await copyFile(resolve(source,'reel.mp4'),directory+'/reel.mp4')
 await copyFile(resolve(source,'cover.jpg'),directory+'/image.jpg')
 await copyFile(resolve(source,'gazi-1936-background.png'),directory+'/background.png')
 await copyFile(resolve(source,'gazi-1936-horse.png'),directory+'/horse.png')
 const caption=await readFile(resolve(source,'caption.txt'),'utf8')
 if(caption.length>2200)throw Error('Caption exceeds Instagram limit')
 const [image]=await uploadImages(id,[directory+'/image.jpg'])
 const video=await uploadVideo(id,directory+'/reel.mp4')
 const manifest={id,account:'ganyan_zekasi',instagramId:'17841441483231653',date:day,kind:'historical_reel',mediaType:'REELS',
  sourceUrls:['https://gazi.tjk.org/History','https://ataturkansiklopedisi.gov.tr/bilgi/gazi-kosusu/?pdf=3651'],
  localImage:'image.jpg',imageSha256:image.sha256,imageUrl:image.url,
  localVideo:'reel.mp4',videoSha256:video.sha256,videoUrl:video.url,
  caption,illustration:'Original representative animation, not actual race footage',
  audio:'Original additive piano synthesized for this video; no third-party recording'}
 await writeFile(directory+'/manifest.json',JSON.stringify(manifest,null,2))
 if(sha(await readFile(directory+'/reel.mp4'))!==video.sha256)throw Error('Video changed after upload')
 await publish(id,'Prepare')
 const result=await publish(id,'Publish')
 const entry=await json(directory+'/publication.json')
 if(entry.status!=='published_verified')throw Error('Instagram publication not verified: '+result)
 console.log(JSON.stringify({status:entry.status,url:entry.permalink,mediaId:entry.mediaId}))
}finally{
 try{const owner=await json(lock);if(owner.pid===process.pid)await unlink(lock)}catch(error){if(error.code!=='ENOENT')console.error('Agent lock cleanup:',error.message)}
}
