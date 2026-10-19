import {readFile,writeFile,mkdir} from 'node:fs/promises'
const normalize=s=>String(s).normalize('NFKD').replace(/\p{M}/gu,'').replace(/ı/g,'i').toUpperCase()
export function xCouponObservations(posts,date,city,parseTemplates){
 const displayDate=new Date(`${date}T12:00:00Z`).toLocaleDateString('tr-TR',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'})
 const numeric=`${date.slice(8)}.${date.slice(5,7)}.${date.slice(0,4)}`
 return posts.flatMap(post=>{
  const text=normalize(post.text||''),cityPattern=new RegExp(`(^|[^A-Z])${normalize(city)}([^A-Z]|$)`)
  // Publication day alone is insufficient: tomorrow's tips are often posted tonight.
  if(!cityPattern.test(text)||![date,numeric,displayDate].some(d=>text.includes(normalize(d))))return []
  if(!/^https:\/\/x\.com\/[A-Za-z0-9_]+\/status\/\d+$/.test(post.url||'')||!Number.isFinite(Date.parse(post.publishedAt))||!Number.isFinite(Date.parse(post.observedAt)))return []
  return parseTemplates(post.text).map(coupon=>({...coupon,date,city,url:post.url,host:'x.com',sourceName:'X',author:post.author,platform:'X',publishedAt:post.publishedAt,observedAt:post.observedAt,engagement:post.engagement||null}))
 })
}
export async function collectXListSources(lists,date,city,parseTemplates,{request=fetch,token=process.env.X_SOCIAL_BEARER_TOKEN,enabled=process.env.X_SOCIAL_API_ENABLED==='1',directory='data/social-x'}={}){
 const observations=[],sources=[],failures=[]
 for(const list of lists){
  if(!/^\d+$/.test(list.id))continue
  let browser=[];try{browser=JSON.parse(await readFile(`${directory}/browser-${list.id}.json`,'utf8')).posts||[]}catch{}
  observations.push(...xCouponObservations(browser,date,city,parseTemplates))
  if(!enabled||!token){sources.push({name:`X · ${list.name||list.id}`,url:list.url,status:'api_access_required'});continue}
  try{
   await mkdir(directory,{recursive:true});const path=`${directory}/api-${list.id}.json`
   let saved;try{saved=JSON.parse(await readFile(path,'utf8'))}catch{}
   if(!saved||Date.now()-Date.parse(saved.fetchedAt)>15*60_000){
    const url=new URL(`https://api.x.com/2/lists/${list.id}/tweets`)
    url.search=new URLSearchParams({max_results:'100','tweet.fields':'created_at,public_metrics,author_id','expansions':'author_id','user.fields':'username'}).toString()
    const response=await request(url,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(12000)})
    if(!response.ok)throw Error(`X API HTTP ${response.status}`)
    const data=await response.json(),users=new Map((data.includes?.users||[]).map(u=>[u.id,u.username])),seen=new Map((saved?.posts||[]).map(p=>[p.id,p.observedAt])),observedAt=new Date().toISOString()
    saved={fetchedAt:observedAt,posts:(data.data||[]).map(p=>({id:p.id,text:p.text,author:users.get(p.author_id)||p.author_id,url:`https://x.com/${users.get(p.author_id)||'i'}/status/${p.id}`,publishedAt:p.created_at,observedAt:seen.get(p.id)||observedAt,engagement:p.public_metrics||null}))}
    await writeFile(path,JSON.stringify(saved,null,2))
   }
   observations.push(...xCouponObservations(saved.posts,date,city,parseTemplates));sources.push({name:`X · ${list.name||list.id}`,url:list.url,status:'checked'})
  }catch(error){failures.push({source:`X · ${list.name||list.id}`,error:error.message})}
 }
 return {observations,sources,failures}
}
