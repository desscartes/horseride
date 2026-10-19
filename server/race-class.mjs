import {horseIdentity} from './data-quality.mjs'
import {racingCountry} from './foreign-data.mjs'

// A local class rank is meaningful only within the same country and breed.
// Claiming prices and Turkish handicap numbers are not international ratings.
export function raceClass(race){
 const country=racingCountry(race.city)||'TR',text=`${race.type||''} ${race.conditions||''}`.normalize('NFKD').replace(/\p{M}/gu,'').replace(/ı/g,'i').toUpperCase().replace(/[^A-Z0-9/ -]/g,' ')
 const breed=/ARAP|ARABIAN/.test(text)?'arabian':/QUARTER/.test(text)?'quarter':'thoroughbred'
 const result=(family,level,rank)=>({country,breed,family,level,rank,key:`${country}:${breed}:${family}:${level}`,known:true})
 const grade=text.match(/\b(?:G(?:ROUP|RADE)?|GRUP)\s*[-/]?\s*([123])\b/)
 if(grade)return result('group',+grade[1],10-+grade[1])
 const roman=text.match(/\b(?:GROUP|GRADE)\s+(III|II|I)\b/)
 if(roman){const level={I:1,II:2,III:3}[roman[1]];return result('group',level,10-level)}
 if(/\bLISTED\b|\bLISTE\b/.test(text))return result('listed',0,6)
 // Maiden eligibility must survive labels such as Maiden/Satış and Maiden Class 5.
 if(/\bMAIDEN\b|\bMAIDAN\b/.test(text))return result(/CLAIM|SATIS/.test(text)?'maiden_claiming':'maiden',0,0)
 if(country==='TR'){
  const sale=text.match(/\bSATIS\s*[-/]?\s*(\d+)\b/)
  if(sale)return result('claiming',+sale[1],null)
  const kv=text.match(/\b(?:KV|KISA VADELI)\s*[-/]?\s*(\d+)\b/)
  if(kv)return result('kv',+kv[1],5)
  const handicap=text.match(/\bHAND[İI]?KAP\s*[-/]?\s*(\d+)\b/)
  if(handicap)return result('handicap',+handicap[1],null)
  const condition=text.match(/\bSARTLI\s*[-/]?\s*(\d+)\b/)
  if(condition)return result('conditional',+condition[1],null)
 }
 const numbered=text.match(/\bCLASS\s*([1-7])\b/)
 if(numbered)return result('class',+numbered[1],8-+numbered[1])
 if(/MAIDEN|MAIDAN/.test(text))return result(/CLAIM/.test(text)?'maiden_claiming':'maiden',0,0)
 if(/ALLOWANCE|ALLOWANCES/.test(text))return result(/OPTIONAL|CLAIM/.test(text)?'allowance_optional_claiming':'allowance',0,3)
 if(/CLAIMING|CLAIMER/.test(text))return result('claiming',0,1)
 if(/STAKES/.test(text))return result('stakes',0,5)
 if(/HANDICAP|HANDIKAP/.test(text))return result('handicap',0,null)
 if(/CONDITIONS|CONDITION/.test(text))return result('conditions',0,null)
 // A translated "Şartlı" label does not establish US allowance/claiming
 // eligibility. Preserve its coarse family without inventing a class rank.
 if(country!=='TR'&&/\bSARTLI\b/.test(text))return result('conditions',0,null)
 return {country,breed,family:'unknown',level:0,rank:null,key:null,known:false}
}
export function classTransition(previous,current){
 if(!previous?.known||!current?.known||previous.country!==current.country||previous.breed!==current.breed)return null
 if(previous.family===current.family&&['handicap','conditional','kv'].includes(current.family)&&current.country==='TR')return current.level-previous.level
 return previous.rank!=null&&current.rank!=null?current.rank-previous.rank:null
}
