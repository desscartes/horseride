// One meeting at a time; failed attempts back off instead of spending on every tick.
export function createAnalysisPrewarmer({ready,run,blocked=()=>false,now=Date.now,retryMs=60000,priorities=[]}) {
 const attempts=new Map();let active=null
 return {
  tick(date,races) {
   if(active)return active
   const priority=city=>{const index=priorities.indexOf(city);return index<0?priorities.length:index}
   const cities=[...new Set(races.map(r=>r.city))].sort((a,b)=>priority(a)-priority(b))
   active=(async()=>{
    for(const city of cities){
     if(blocked())break
     const key=`${date}:${city}`
     if(ready(date,city)||now()-(attempts.get(key)??-Infinity)<retryMs)continue
     attempts.set(key,now())
     try{await run(date,city);attempts.delete(key)}catch(error){console.error('Analysis preparation:',city,error.message)}
    }
   })().finally(()=>{active=null;for(const key of attempts.keys())if(!key.startsWith(date+':'))attempts.delete(key)})
   return active
  }
 }
}
