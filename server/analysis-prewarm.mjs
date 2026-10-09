// One meeting at a time; failed attempts back off instead of spending on every tick.
export function createAnalysisPrewarmer({ready,run,now=Date.now,retryMs=30*60000}) {
 const attempts=new Map();let active=null
 return {
  tick(date,races) {
   if(active)return active
   const cities=[...new Set(races.map(r=>r.city))]
   active=(async()=>{
    for(const city of cities){
     const key=`${date}:${city}`
     if(ready(date,city)||now()-(attempts.get(key)??-Infinity)<retryMs)continue
     attempts.set(key,now())
     try{await run(date,city)}catch(error){console.error('Analysis preparation:',city,error.message)}
    }
   })().finally(()=>{active=null;for(const key of attempts.keys())if(!key.startsWith(date+':'))attempts.delete(key)})
   return active
  }
 }
}
