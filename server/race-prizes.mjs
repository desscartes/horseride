import {horseIdentity} from './data-quality.mjs'
// TJK CSV lists runner prizes before breeder premiums. Preserve source currency.
export function restoreProgramPrizes(stored,source){
 return stored.map(race=>{
  const candidates=source.filter(r=>r.city===race.city&&Number(r.no)===Number(race.no)&&r.distance===race.distance&&r.surface===race.surface)
  if(candidates.length!==1||!candidates[0].prizeMoney)return race
  const field=r=>r.horses.filter(h=>!h.outOfRace).map(h=>`${h.no}:${horseIdentity(h.name)}`).sort()
  if(JSON.stringify(field(race))!==JSON.stringify(field(candidates[0])))return race
  return {...race,prizeMoney:candidates[0].prizeMoney}
 })
}
export function parseRacePrizes(cells){
 const prizes=[]
 for(const cell of cells.slice(0,5)){
  const m=String(cell).trim().match(/^([1-5])\.\)\s*([\d.]+(?:,\d{1,2})?)\s*(TL|₺|\$|USD|EUR|€|GBP|£)\s*$/i)
  if(!m)continue
  const amount=Number(m[2].replaceAll('.','').replace(',','.'))
  if(!Number.isFinite(amount)||amount<=0)continue
  const currency=/TL|₺/i.test(m[3])?'TRY':/USD|\$/.test(m[3])?'USD':/EUR|€/.test(m[3])?'EUR':'GBP'
  prizes.push({position:Number(m[1]),amount,currency})
 }
 return prizes
}
