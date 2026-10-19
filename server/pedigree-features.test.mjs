import test from 'node:test'
import assert from 'node:assert/strict'
import {horsePedigree,pedigreeGoing,createPedigreeHistory,addPedigreeDay,pedigreeFeatures,pedigreeFeatureNames} from './pedigree-features.mjs'
const race=(date,surface='Kum',condition='Islak')=>({city:'Bursa',surface,distance:'1400m',conditions:'İNGİLİZ',environment:{date,weather:'20 C Nem %60',tracks:[{surface,condition}]},horses:[{no:1,name:'A KG',sire:'S (GB)',dam:'D - DS (IRE)'},{no:2,name:'B',sire:'S (GB)',dam:'D - DS (IRE)'}],results:new Map([[1,{finishPosition:1}],[2,{finishPosition:2}]])})
const value=(vector,name)=>vector[pedigreeFeatureNames.indexOf(name)]
test('parents and maternal grandsire remain separate; unknowns stay missing',()=>{
  assert.deepEqual(horsePedigree({sire:'S (GB)',dam:'D - DS (IRE)'}),{sire:'SGB',dam:'D',damsire:'DSIRE'})
  assert.equal(horsePedigree({dam:'D'}).damsire,null)
  assert.equal(horsePedigree({sire:'Bilinmiyor'}).sire,null)
})
test('track condition must be dated and explicit; rainfall does not imply wet going',()=>{
  const r=race('2026-01-01');assert.equal(pedigreeGoing(r,r.environment.date),'wet')
  r.environment.tracks[0].condition='Normal';assert.equal(pedigreeGoing(r,r.environment.date),'dry')
  r.environment.tracks[0].condition='';r.environment.weather='Yağmurlu';assert.equal(pedigreeGoing(r,r.environment.date),null)
  assert.equal(pedigreeGoing(r,'2026-01-02'),null)
})
test('future and same-day results and own performance never enter family statistics',()=>{
  const clean=createPedigreeHistory();addPedigreeDay(clean,[race('2026-01-01')],'2026-01-01');addPedigreeDay(clean,[race('2026-01-03')],'2026-01-03')
  const target=race('2026-01-03');const [a,b]=pedigreeFeatures(target,'2026-01-03',clean)
  assert.equal(value(a,'sireAllStarts'),1);assert.equal(value(a,'sireAllWin'),1/11)
  assert.equal(value(b,'sireAllWin'),2/11);assert.equal(value(a,'damAllStarts'),1)
  assert.equal(a.length,pedigreeFeatureNames.length)
  assert.equal(value(pedigreeFeatures(target,'2026-01-01',clean)[0],'sireAllStarts'),0)
})
test('surface, going, country and breed cohorts cannot contaminate each other',()=>{
  const history=createPedigreeHistory();addPedigreeDay(history,[race('2026-01-01','Çim','Normal')],'2026-01-01')
  const target=race('2026-01-02');let f=pedigreeFeatures(target,'2026-01-02',history)[0]
  assert.equal(value(f,'sireAllStarts'),1);assert.equal(value(f,'sireSurfaceStarts'),0);assert.equal(value(f,'sireGoingStarts'),0)
  target.conditions='ARAP';f=pedigreeFeatures(target,'2026-01-02',history)[0];assert.equal(value(f,'sireAllStarts'),0)
})
