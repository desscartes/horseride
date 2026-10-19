import test from 'node:test'
import assert from 'node:assert/strict'
import {enrichRunnerPedigree} from './enrich-runner-pedigree.mjs'
import {parseTjkPedigree} from './pedigree-registry.mjs'
import {maternalRecordKey} from './program-maternal-lines.mjs'
const horse={name:'TEST (USA)',horseId:'12',sire:'SIRE',dam:'DAM'}
const chart={name:'TEST',sire:'SIRE',dam:'DAM',damsire:'GRANDSIRE',date:'2026-10-01',sourceUrl:'https://tvg.equibase.com/static/chart/pdf/GP100126USA.pdf',availability:'post_race_static_pedigree'}
test('verified official program ancestry applies to Ireland and US with identity guards',()=>{
 for(const city of ['Leopardstown İrlanda','Keeneland ABD']){
  const date='2026-10-18',h={...horse,dam:'DAM (GRANDSIRE)'},race={city,no:1,horses:[h]}
  const row={date,name:h.name,sire:h.sire,rawDam:h.dam,damsire:'GRANDSIRE',provider:'TJK official program CSV',sourceUrl:'https://medya-cdn.tjk.org/raporftp/TJKPDF/2026/2026-10-18/CSV/GunlukYarisProgrami/program.csv'}
  const maternalRecords={[maternalRecordKey(date,race,h)]:row}
  const apply=r=>enrichRunnerPedigree([r],date,{registry:{},charts:[],maternalRecords})[0].horses[0]
  assert.equal(apply(race).damsire,'GRANDSIRE')
  assert.equal(apply({...race,horses:[{...h,sire:'OTHER'}]}).damsire,undefined)
 }
})
test('current US horse receives only dated parent-verified chart pedigree',()=>{
 const apply=(h,date,rows=[chart],city='Gulfstream Park ABD')=>enrichRunnerPedigree([{city,horses:[h]}],date,{registry:{},charts:rows})[0].horses[0]
 assert.equal(apply(horse,'2026-10-02').damsire,'GRANDSIRE')
 assert.equal(apply(horse,'2026-10-01').damsire,undefined)
 assert.equal(apply({...horse,sire:'OTHER'},'2026-10-02').damsire,undefined)
 assert.equal(apply(horse,'2026-10-02',[chart,{...chart,damsire:'CONFLICT'}]).damsire,undefined)
 assert.equal(apply(horse,'2026-10-02',[chart],'Redcar Birleşik Krallık').damsire,undefined)
 assert.equal(apply({...horse,damsire:'EXISTING'},'2026-10-02').damsire,'EXISTING')
 assert.equal(horse.damsire,undefined)
})
test('official registry requires matching parents and horse id in live context',()=>{
 const registry={'12':{sire:'SIRE',dam:'DAM',damsire:'GRANDSIRE'}}
 const apply=h=>enrichRunnerPedigree([{city:'İstanbul',horses:[h]}],'2026-10-02',{registry,charts:[]})[0].horses[0]
 assert.equal(apply(horse).damsire,'GRANDSIRE')
 assert.equal(apply({...horse,horseId:'99'}).damsire,undefined)
 assert.equal(apply({...horse,dam:'OTHER'}).damsire,undefined)
})
test('Japanese sire suffix does not hide an otherwise exact official parent match',()=>{
 const h={...horse,sire:'SAXON WARRIOR (JPN)',dam:'CHILLSEA (USA)'}
 const html='<div><span class="key">Baba</span><span class="value">SAXON WARRIOR</span></div><div><span class="key">Anne</span><span class="value">CHILLSEA / MSHAWISH</span></div>'
 const url='https://www.tjk.org/TR/YarisSever/Query/ConnectedPage/AtKosuBilgileri?QueryParameter_AtId=12'
 assert.equal(parseTjkPedigree(html,h,url)?.damsire,'MSHAWISH')
 assert.equal(parseTjkPedigree(html,{...h,sire:'OTHER (JPN)'},url),null)
 const record={...chart,sire:'SAXON WARRIOR',dam:'CHILLSEA',damsire:'MSHAWISH'}
 assert.equal(enrichRunnerPedigree([{city:'Gulfstream Park ABD',horses:[h]}],'2026-10-02',{registry:{},charts:[record]})[0].horses[0].damsire,'MSHAWISH')
})
