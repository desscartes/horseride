import test from 'node:test'
import assert from 'node:assert/strict'
import {parseMaternalColumn,verifiedProgramMaternalLine,maternalRecordKey} from './program-maternal-lines.mjs'
test('explicit maternal name is separated without treating birth country as an ancestor',()=>{
 assert.deepEqual(parseMaternalColumn('SASSICAIA (DOYEN)'),{dam:'SASSICAIA',damsire:'DOYEN'})
 assert.deepEqual(parseMaternalColumn('ARABIAN JAZZ (AUS)(DANEHILL DANCER (IRE))'),{dam:'ARABIAN JAZZ (AUS)',damsire:'DANEHILL DANCER'})
 for(const raw of ['HARVEST JOY (IRE)','CHILLSEA (USA)','DAM (ZIM)','DAM (ITY)','DAM (SWE)','DAM (PARENT','DAM (UNKNOWN)','DAM (A (OTHER))','(PARENT)'])assert.equal(parseMaternalColumn(raw),null)
 assert.deepEqual(parseMaternalColumn('DAM (VAR)'),{dam:'DAM',damsire:'VAR'})
})
test('program maternal evidence requires date, field identity, both parents and canonical official source',()=>{
 const date='2026-10-13',race={city:'Longchamp Fransa',no:1},horse={no:3,name:'TEST',sire:'SIRE',dam:'DAM (DOYEN)'}
 const row={date,name:horse.name,sire:horse.sire,rawDam:horse.dam,damsire:'DOYEN',provider:'TJK official program CSV',sourceUrl:'https://medya-cdn.tjk.org/raporftp/TJKPDF/2026/2026-10-13/CSV/GunlukYarisProgrami/program.csv'}
 const key=maternalRecordKey(date,race,horse),records={[key]:row}
 assert.equal(verifiedProgramMaternalLine(horse,race,date,records)?.damsire,'DOYEN')
 assert.equal(verifiedProgramMaternalLine({...horse,sire:'OTHER'},race,date,records),null)
 assert.equal(verifiedProgramMaternalLine({...horse,no:4},race,date,records),null)
 assert.equal(verifiedProgramMaternalLine(horse,race,'2026-10-12',records),null)
 for(const change of [{damsire:'INVENTED'},{sourceUrl:row.sourceUrl.replace('medya-cdn.tjk.org','example.com')},{date:'2026-10-14'}])assert.equal(verifiedProgramMaternalLine(horse,race,date,{[key]:{...row,...change}}),null)
})
