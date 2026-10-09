export function analysisCacheSignature(races,city){
 return JSON.stringify(races.filter(r=>r.city===city).map(r=>({no:r.no,time:r.time,type:r.type,distance:r.distance,surface:r.surface,model:r.rankingMethod,trainedThrough:r.rankingEvidence?.trainedThrough,picks:r.rankingSource==='local_trained_model'?r.horses.slice(0,4).map(h=>h.name):null,horses:r.horses.map(h=>({no:h.no,name:h.name,weight:h.weight,start:h.start,jockey:h.jockey,trainer:h.trainer})).sort((a,b)=>a.no-b.no)})).sort((a,b)=>a.no-b.no))
}
export function createDailyAnalysisCache({storage,now=Date.now,maxEntries=20}={}){
 const memory=new Map()
 const key=(scope,city,date)=>`ganyan-ai-cache-v1:${scope}:${date}:${city}`
 return {
  get(scope,city,date,signature){
   const id=key(scope,city,date)
   let record=memory.get(id)
   if(!record)try{record=JSON.parse(storage?.getItem(id))}catch{}
   if(!record||record.signature!==signature||now()-record.savedAt>24*3600000)return null
   memory.set(id,record);return structuredClone(record.payload)
  },
  save(scope,city,date,signature,payload){
   if(payload?.city!==city||payload.date!==date||!payload.analysis?.races?.length)return
   const id=key(scope,city,date),record={savedAt:now(),signature,payload:structuredClone(payload)}
   memory.delete(id);memory.set(id,record)
   while(memory.size>maxEntries)memory.delete(memory.keys().next().value)
   try{storage?.setItem(id,JSON.stringify(record))}catch{}
  },
 }
}
