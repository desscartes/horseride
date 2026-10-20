import {createServer} from 'node:http'
import {readFile,stat} from 'node:fs/promises'
import {resolve,extname,sep} from 'node:path'
import {fileURLToPath} from 'node:url'
import {localDay,shiftDay} from './maintenance-policy.mjs'
import {jsonTransfer} from './json-transfer.mjs'

const defaultRoot=fileURLToPath(new URL('../dist/',import.meta.url))
const publicReads=new Set(['/api/simulation','/api/races','/api/meetings','/api/analysis/daily','/api/commentary','/api/social-coupons','/api/history/horse','/api/history/races','/api/performance','/api/application-report','/api/daily-ticket','/api/coupon-showcase','/api/analysis/usage'])
export function createPublicGateway({upstream='http://127.0.0.1:8788',root=defaultRoot,fetcher=fetch}={}){
 const directory=resolve(root)
 const recordings=new Map()
 return createServer(async(req,res)=>{
  const reply=(status,payload)=>{const transfer=jsonTransfer(payload,req.headers['accept-encoding']);res.writeHead(status,{...transfer.headers,'cache-control':'no-store','access-control-allow-origin':'*'});res.end(transfer.body)}
  try{
   const url=new URL(req.url,'http://localhost')
   if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-origin':'*','access-control-allow-methods':'GET,HEAD,POST,OPTIONS','access-control-allow-headers':'content-type'});return res.end()}
   if(url.pathname==='/api/health'){
    if(req.method!=='GET')return reply(405,{error:'Method not allowed'})
    const response=await fetcher(upstream+'/api/health',{signal:AbortSignal.timeout(5000)})
    return reply(response.ok?200:503,{ok:response.ok,service:'horseride-public'})
   }
   if(url.pathname.startsWith('/api/')){
    if(url.pathname==='/api/recommendations/record'){
     if(req.method!=='POST')return reply(405,{error:'Method not allowed'})
     const key=req.socket.remoteAddress,now=Date.now(),rate=recordings.get(key)||{at:now,count:0};if(now-rate.at>60000){rate.at=now;rate.count=0}if(++rate.count>30)return reply(429,{error:'Kupon kayıt sınırına ulaşıldı.'});recordings.set(key,rate);if(recordings.size>1000)recordings.delete(recordings.keys().next().value)
     let body='',bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>8192)return reply(413,{error:'Request too large'});body+=chunk}
     const parsed=JSON.parse(body)
     const day=localDay()
     if(![shiftDay(day,-1),day,shiftDay(day,1)].includes(parsed.date)||typeof parsed.city!=='string'||!parsed.city.trim()||parsed.city.length>80||!['5li-ganyan','6li-ganyan'].includes(parsed.marketId)||!Number.isInteger(parsed.budget)||parsed.budget<20||parsed.budget>12000||parsed.budget%10||!Number.isInteger(parsed.startRaceNo)||parsed.startRaceNo<1||parsed.startRaceNo>30||typeof parsed.selections!=='string'||parsed.selections.length>4096)return reply(400,{error:'Geçersiz kupon kaydı.'})
     const payload=Object.fromEntries(['date','city','marketId','budget','startRaceNo','selections'].map(k=>[k,parsed[k]]))
     const response=await fetcher(new URL(url.pathname,upstream),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)})
     return reply(response.status,await response.json())
    }
    if(/^\/api\/analysis\/jobs\/[0-9a-f-]{36}$/.test(url.pathname)){
     if(req.method!=='GET')return reply(405,{error:'Method not allowed'})
     const response=await fetcher(new URL(url.pathname,upstream),{method:'GET',signal:AbortSignal.timeout(15000)})
     return reply(response.status,await response.json())
    }
    if(!publicReads.has(url.pathname))return reply(404,{error:'Not found'})
    if(req.method==='POST'&&url.pathname==='/api/analysis/daily'){
     let bytes=0,body=''
     for await(const chunk of req){bytes+=chunk.length;if(bytes>8192)return reply(413,{error:'Request too large'});body+=chunk}
     const parsed=JSON.parse(body)
     url.search=new URLSearchParams({date:String(parsed.date||''),city:String(parsed.city||'')}).toString()
    }else if(req.method!=='GET')return reply(405,{error:'Method not allowed'})
    if(url.pathname==='/api/application-report'){
     const target=new URL(url.pathname,upstream)
     for(const [key,values]of Object.entries({period:['week','total'],scope:['all','domestic','foreign'],source:['numeric','daily_ai']})){
      const value=url.searchParams.get(key)||values[0];if(!values.includes(value))return reply(400,{error:'Geçersiz rapor filtresi.'});target.searchParams.set(key,value)
     }
     const response=await fetcher(target,{method:'GET',signal:AbortSignal.timeout(15000)});return reply(response.status,await response.json())
    }
    if(url.pathname.startsWith('/api/history/')||url.pathname==='/api/performance'){
     const target=new URL(url.pathname,upstream)
     if(url.pathname==='/api/history/horse'){
      const name=(url.searchParams.get('name')||'').trim()
      if(!name||name.length>200)return reply(400,{error:'Geçerli at adı gerekli.'})
      target.searchParams.set('name',name)
     }
     if(url.pathname==='/api/performance'){
      const days=Number(url.searchParams.get('days')||90)
      if(!Number.isInteger(days)||days<1||days>90)return reply(400,{error:'Geçerli gün sayısı gerekli.'})
      target.searchParams.set('days',String(days))
     }
     const response=await fetcher(target,{method:'GET',signal:AbortSignal.timeout(15000)})
     return reply(response.status,await response.json())
    }
    const day=localDay(),date=url.searchParams.get('date')||day
    if(![shiftDay(day,-1),day,shiftDay(day,1)].includes(date))return reply(400,{error:'Yalnızca dün, bugün ve yarın kullanılabilir.'})
    const city=url.searchParams.get('city')||'Tümü'
    if(city.length>80)return reply(400,{error:'Invalid city'})
    const target=new URL(url.pathname,upstream)
    target.search=new URLSearchParams({date,city}).toString()
    // Never forward a public POST: expensive analysis/training stays server-managed.
    const response=await fetcher(target,{method:'GET',signal:AbortSignal.timeout(15000)})
    const payload=await response.json()
    if(req.method==='POST'&&payload.job?.status==='running')return reply(202,{job:payload.job})
    if(req.method==='POST'&&!payload.analysis)return reply(503,{error:'Analiz sunucuda hazırlanıyor; hazır olduğunda otomatik gösterilecek.'})
    return reply(response.status,payload)
   }
   if(!['GET','HEAD'].includes(req.method))return reply(405,{error:'Method not allowed'})
   const pathname=decodeURIComponent(url.pathname)
   const relative=pathname==='/'?'index.html':pathname.replace(/^\/+/, '')
   if(relative.split(/[\\/]/).some(part=>part.startsWith('.')))return reply(404,{error:'Not found'})
   const path=resolve(directory,relative)
   if(!path.startsWith(directory+sep))return reply(404,{error:'Not found'})
   const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.ico':'image/x-icon','.json':'application/json','.woff2':'font/woff2','.apk':'application/vnd.android.package-archive'}
   const mime=types[extname(path)]
   if(!mime||!(await stat(path)).isFile())return reply(404,{error:'Not found'})
   res.writeHead(200,{'content-type':mime,'x-content-type-options':'nosniff','cache-control':extname(path)==='.html'?'no-cache':'public, max-age=3600'})
   res.end(req.method==='HEAD'?undefined:await readFile(path))
  }catch(error){reply(error.code==='ENOENT'?404:502,{error:'İstek tamamlanamadı.'})}
 })
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 createPublicGateway().listen(Number(process.env.PUBLIC_PORT||8790),'127.0.0.1',()=>console.log('Public gateway listening on loopback'))
}
