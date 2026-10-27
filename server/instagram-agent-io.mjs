import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {mkdir,readFile,copyFile,writeFile,access} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {resolve} from 'node:path'
const exec=promisify(execFile),repo=resolve('data/instagram/media-repo')
export const sha=b=>createHash('sha256').update(b).digest('hex')
export async function uploadImages(id,paths){return uploadAssets(id,paths,'jpg')}
export async function uploadVideo(id,path){return (await uploadAssets(id,[path],'mp4'))[0]}
async function uploadAssets(id,paths,extension){
 if(!/^[a-z0-9-]{1,90}$/.test(id))throw Error('Invalid asset id')
 await mkdir(repo,{recursive:true})
 const git=async args=>(await exec('git',['-c','credential.interactive=false',...args],{cwd:repo,windowsHide:true,timeout:45000,env:{...process.env,GIT_TERMINAL_PROMPT:'0'}})).stdout.trim()
 try{await access(repo+'/.git')}catch{await git(['init']);await git(['checkout','--orphan','instagram-media']);await git(['remote','add','origin','https://github.com/desscartes/horseride.git']);try{await git(['fetch','origin','instagram-media']);await git(['reset','--hard','origin/instagram-media'])}catch{}}
 await mkdir(repo+'/public/social',{recursive:true});const files=[]
 for(const [i,path]of paths.entries()){const bytes=await readFile(path),name=id+'-'+(i+1)+'-'+sha(bytes).slice(0,12)+'.'+extension;await copyFile(path,repo+'/public/social/'+name);files.push({name,sha256:sha(bytes),localName:extension==='mp4'?'reel.mp4':'slide-'+(i+1)+'.jpg'})}
 await git(['add','public/social'])
 if(await git(['diff','--cached','--name-only']))await git(['-c','user.name=HorseRide media','-c','user.email=horseride@localhost','commit','-m','Publish Instagram media '+id])
 const commit=await git(['rev-parse','HEAD']);await git(['push','origin','HEAD:refs/heads/instagram-media'])
 for(const file of files){file.url=`https://raw.githubusercontent.com/desscartes/horseride/${commit}/public/social/${file.name}`;const response=await fetch(file.url,{signal:AbortSignal.timeout(20000)});if(!response.ok||sha(Buffer.from(await response.arrayBuffer()))!==file.sha256)throw Error('Public image verification failed')}
 return files
}
export async function publish(id,mode){
 const result=await exec('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',resolve('server/publish-instagram-introduction.ps1'),'-PublicationId',id,'-Mode',mode],{windowsHide:true,timeout:120000,maxBuffer:100000})
 return result.stdout.trim()
}
export async function renderMeeting(draft,directory){
 const {chromium}=await import('../.migration/ui-audit-tools/node_modules/playwright/index.mjs')
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
 const logo=(await readFile('public/brand/ganyan-icon.png')).toString('base64'),photo=(await readFile('public/social/ganyan-campaign-v2.jpg')).toString('base64')
 const panels=[{title:'50 TL bütçeli altılı',main:`${draft.ticket.ordinal}. altılı · ${draft.ticket.cost.toFixed(2)} TL`,body:draft.ticket.legs.map(l=>`<div class="leg"><b>${l.raceNo}. koşu</b><strong>${l.horses.map(h=>h.number).join(' · ')}</strong></div>`).join(''),note:'Bütçe içinde model kapsamına göre seçim. Ayak puanlarının çarpımı gerçek tutma oranı değildir.'},{title:'Modelin ilk adayı',main:`${draft.first.raceNo}. koşu · ${draft.first.number}`,body:`<h2>${esc(draft.first.name)}</h2><p>${esc(draft.first.reason)}</p>`,note:'Tek atlık adaydır; kesin kazanan veya garanti banko değildir.'},{title:'Sürpriz adayı',main:draft.surprise?`${draft.surprise.raceNo}. koşu · ${draft.surprise.number}`:'Seçim yapmıyoruz',body:draft.surprise?`<h2>${esc(draft.surprise.name)}</h2><p>${esc(draft.surprise.reason)}</p><p>AGF ve ana sıralamada ilk iki dışındaki en yüksek model puanlı uygun aday.</p>`:'<p>Doğrulanmış uygun aday bulunmadı. Eksik bilgiyi varsayarak at önermiyoruz.</p>',note:'Sürpriz, yüksek kazanma ihtimali anlamına gelmez.'}]
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true})
 try{const page=await browser.newPage({viewport:{width:1080,height:1350},deviceScaleFactor:1}),paths=[]
 for(const [i,p]of panels.entries()){const html=`<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;width:1080px;height:1350px;padding:66px;background:#071a20;color:#f5f0dd;font-family:Arial}body:before{content:"";position:absolute;inset:0 0 auto;height:390px;background:linear-gradient(180deg,rgba(7,26,32,.25),#071a20),url(data:image/jpeg;base64,${photo}) center -490px/1080px auto;z-index:-1}body{isolation:isolate}header{display:flex;align-items:center;gap:23px;color:#91dfbf;font-size:25px;letter-spacing:2px}header img{width:100px;border-radius:50%}.city{font-size:34px;color:#d8b769;margin-top:95px}h1{font-size:58px;line-height:1.1;margin:22px 0 28px}.main{font-size:35px;color:#91dfbf;padding:20px 0;border-top:1px solid #42635b;border-bottom:1px solid #42635b}.body{padding-top:30px}h2{font-size:65px;line-height:1.15;overflow-wrap:anywhere}p{font-size:32px;line-height:1.6;color:#c2d4d0}.leg{display:flex;justify-content:space-between;padding:15px 5px;border-bottom:1px solid #28433f;font-size:33px}.leg strong{max-width:690px;text-align:right}.note{position:absolute;left:66px;right:66px;bottom:135px;font-size:25px;color:#c2d4d0;line-height:1.5}footer{position:absolute;bottom:65px;left:66px;right:66px;display:flex;justify-content:space-between;font-size:23px;color:#91dfbf}</style><header><img src="data:image/png;base64,${logo}">GANYAN ZEKÂSI</header><div class="city">${esc(draft.city)} · ${esc(draft.date)}</div><h1>${p.title}</h1><div class="main">${esc(p.main)}</div><div class="body">${p.body}</div><div class="note">${p.note}</div><footer><span>@ganyan_zekasi</span><span>18+ · Kazanç garantisi yok · ${i+1}/3</span></footer>`
 await page.setContent(html);await page.evaluate(()=>document.fonts.ready);const overflow=await page.evaluate(()=>document.querySelector('.body').getBoundingClientRect().bottom>document.querySelector('.note').getBoundingClientRect().top-15);if(overflow)throw Error('Post layout overflow')
 const path=directory+'/slide-'+(i+1)+'.jpg';await page.screenshot({path,type:'jpeg',quality:95});paths.push(path)}return paths
 }finally{await browser.close()}
}

export async function renderResults(day,result,directory){
 const {chromium}=await import('../.migration/ui-audit-tools/node_modules/playwright/index.mjs'),browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true})
 try{const page=await browser.newPage({viewport:{width:1080,height:1350}});await page.setContent(`<meta charset="utf-8"><style>body{margin:0;box-sizing:border-box;width:1080px;height:1350px;padding:80px;background:#091e22;color:#eeeadd;font:34px Arial}h1{font-size:70px;color:#e3bd65}p{line-height:1.7}strong{color:#8ce1bd}footer{margin-top:90px;font-size:27px;color:#a2c6bf}</style><p>GANYAN ZEKÂSI · ${day}</p><h1>Paylaştık.<br>Sonucunu izliyoruz.</h1><p>Sonuçlanan şehir paketi: <strong>${result.settled}</strong><br>Tutan altılı: <strong>${result.couponWins}/${result.settled}</strong><br>Kazanan ilk aday: <strong>${result.firstWins}/${result.settled}</strong><br>Kazanan sürpriz: <strong>${result.surpriseWins}/${result.surpriseEvaluated}</strong><br>Sonuçlanan kuponların maliyeti: <strong>${result.totalCost.toFixed(2)} TL</strong><br>Alan değişimi nedeniyle kıyas dışı: ${result.excluded}</p><p>Resmî ikramiye doğrulanmadan kâr veya ROI hesaplamıyoruz.</p><footer>@ganyan_zekasi · 18+<br>Kazanan ve kaybeden tüm yayımlanmış seçimler.</footer>`);const path=directory+'/slide-1.jpg';await page.screenshot({path,type:'jpeg',quality:95});return [path]}finally{await browser.close()}
}

export async function verifyConnection(){await exec('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',resolve('server/check-instagram-connection.ps1')],{windowsHide:true,timeout:90000,maxBuffer:20000})}

export async function refreshPublicationReadiness(day){await exec(process.execPath,['--use-system-ca','server/audit-preparation-readiness.mjs',day],{windowsHide:true,timeout:60000,maxBuffer:100000})}
export async function confirmPublicationProgram(day){await exec(process.execPath,['--use-system-ca','server/confirm-publication-program.mjs',day],{windowsHide:true,timeout:120000,maxBuffer:100000})}
export async function auditPublicationNeeds(day){await exec(process.execPath,['--use-system-ca','server/audit-publication-needs.mjs',day],{windowsHide:true,timeout:60000,maxBuffer:100000})}
