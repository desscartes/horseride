import {marketOrdinals,parseOfficialMarkets} from '../src/data/officialMarkets.js'
export function sixLegOrdinals(text,fallback=1){
 const normalized=String(text).normalize('NFKD').replace(/\p{M}/gu,'').replace(/ı/g,'i').toUpperCase()
 return [...new Set([...normalized.matchAll(/(?:\b([12])\s*\.\s*)?\b6\s*['’]?\s*LI\s+GANYAN\b/g)].map(m=>m[1]?Number(m[1]):fallback))]
}
export function officialSixLegCsvUrl(date,city){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!String(city).trim())throw Error('Geçersiz resmi program tarihi veya hipodrom')
 const [year,month,day]=date.split('-')
 return `https://medya-cdn.tjk.org/raporftp/TJKPDF/${year}/${date}/CSV/GunlukYarisProgrami/${day}.${month}.${year}-${encodeURIComponent(city.trim())}-GunlukYarisProgrami-TR.csv`
}
export function parseSixLegCsv(text){
 return parseOfficialMarkets(text).filter(s=>s.legCount===6).map(({ordinal,raceNo})=>({ordinal,raceNo}))
}
