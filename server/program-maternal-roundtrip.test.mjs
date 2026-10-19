import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
process.env.HORSERIDE_DB=join(mkdtempSync(join(tmpdir(),'horseride-maternal-')),'test.sqlite')
const {saveProgram,getProgramForAnalysis}=await import('./database.mjs')
test('official maternal evidence survives program storage and mismatched evidence is refused',()=>{
 const date='2026-10-13',city='Longchamp Fransa'
 const row={date,city,name:'A',sire:'SIRE',rawDam:'DAM (DOYEN)',damsire:'DOYEN',provider:'TJK official program CSV',sourceUrl:'https://medya-cdn.tjk.org/raporftp/TJKPDF/2026/2026-10-13/CSV/GunlukYarisProgrami/program.csv'}
 const horse={no:1,name:'A',sire:'SIRE',dam:'DAM (DOYEN)',sourceData:{tjk:{programMaternalLine:row}}}
 saveProgram({date,city,fetchedAt:'2026-10-13T10:00:00Z',races:[{city,no:1,horses:[horse,{...horse,no:2,name:'B'}]}]})
 const [race]=getProgramForAnalysis(date,city,{includeWorkouts:false})
 assert.equal(race.horses.find(h=>h.name==='A').damsire,'DOYEN')
 assert.equal(race.horses.find(h=>h.name==='B').damsire,undefined)
 assert.equal(race.horses.find(h=>h.name==='A').dam,'DAM (DOYEN)')
})
