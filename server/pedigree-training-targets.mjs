import {racingCountry} from './foreign-data.mjs'
import {validatedRegistryPedigree,pedigreeParentIdentity} from './pedigree-registry.mjs'
export function pedigreeTrainingTargets(races,{through,countries=['TR'],registry={},retries={},now=Date.now(),limit=200}={}){
 const targets=new Map(),seen=new Set(),conflicts=new Set()
 for(const race of races){if(!race.date||race.date>through||!countries.includes(racingCountry(race.city)||'TR'))continue
  for(const horse of race.horses){const id=String(horse.horseId||horse.sourceData?.tjk?.horseId||'');if(!/^[1-9]\d*$/.test(id)||!horse.sire||!horse.dam||validatedRegistryPedigree(horse,registry))continue
   const identity=JSON.stringify([pedigreeParentIdentity(horse.sire),pedigreeParentIdentity(String(horse.dam).split(/\s+[-–—/]\s+/)[0])]),key=JSON.stringify([race.date,race.city,race.no,id])
   const previous=targets.get(id);if(previous&&previous.identity!==identity){conflicts.add(id);continue}
   if(seen.has(key))continue;seen.add(key)
   if(previous)previous.observedStarts++;else targets.set(id,{id,horse,identity,observedStarts:1})
  }
 }
 return [...targets.values()].filter(t=>!conflicts.has(t.id)&&(!retries[t.id]||Date.parse(retries[t.id].after)<=now)).sort((a,b)=>b.observedStarts-a.observedStarts||Number(a.id)-Number(b.id)).slice(0,limit)
}
