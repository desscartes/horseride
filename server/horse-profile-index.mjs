export function profileUrlsByHorse(rows){
 const map=new Map();
 for(const row of rows){try{
  const id=new URL(row.url).searchParams.get('QueryParameter_AtId');if(!id)continue;
  const urls=map.get(id)||[];urls.push(row.url);map.set(id,urls);
 }catch{}}
 return map;
}
export function createProfileReader(database,{now=Date.now,maxAgeMs=60000}={}){
 const caches=new Map();
 return (horseId,source='tjk_horse_history')=>{
  if(!horseId)return null;
  let cache=caches.get(source);
  if(!cache||now()-cache.at>=maxAgeMs){
   const rows=database.prepare('SELECT DISTINCT provider_url AS url FROM source_snapshots WHERE source=?').iterate(source);
   cache={at:now(),urls:profileUrlsByHorse(rows)};caches.set(source,cache);
  }
  const urls=cache.urls.get(String(horseId))||[];if(!urls.length)return null;
  // Exact URL equality uses the existing (source,provider_url,fetched_at) index.
  // Keep all matching URL variants and fall back through malformed newer JSON.
  const rows=database.prepare(`SELECT raw_content AS content FROM source_snapshots WHERE source=? AND provider_url IN (${urls.map(()=>'?').join(',')}) ORDER BY fetched_at DESC`).iterate(source,...urls);
  for(const row of rows){try{return JSON.parse(row.content)}catch{}}
  return null;
 };
}
