import test from 'node:test'
import assert from 'node:assert/strict'
import {buildWinnerOnlyTarget} from './winner-only-target.mjs'
const race={no:1,horses:Array.from({length:6},(_,i)=>({no:i+1,name:'HORSE '+(i+1)+' (AUS)'}))}
const results=new Map(race.horses.slice(0,4).map((h,i)=>[h.no,{finishPosition:i+1,sourceName:h.name+' ('+h.no+')'}]))
test('winner labels do not invent unobserved finishing positions or history',()=>{const r=buildWinnerOnlyTarget(race,results,{date:'2026-04-02',city:'Pakenham Avustralya'});assert.equal(r.winnerNo,1);assert.equal(r.winnerEvidence.historyEligible,false);assert.equal(r.results[5][1].finishPosition,null);assert.equal(r.results[5][1].knownNonWinner,true);assert.equal(r.winnerEvidence.missingFinishingPositions,2)})
test('ambiguous winners or mismatched official runner identity reject targets',()=>{const wrong=new Map(results);wrong.set(2,{finishPosition:1,sourceName:'HORSE 2 (AUS)'});assert.equal(buildWinnerOnlyTarget(race,wrong),null);const names=new Map(results);names.set(2,{finishPosition:2,sourceName:'DIFFERENT'});assert.equal(buildWinnerOnlyTarget(race,names),null)})
import {mergeWinnerTargets} from './winner-only-target.mjs'
import {raceFeatures,createRankingHistory} from './ranking.mjs'
test('complete results supersede duplicate winner-only targets without relabelling unknown positions',()=>{
 const target=buildWinnerOnlyTarget(race,results,{date:'2026-04-02',city:'Pakenham Avustralya'}),complete={...race,date:target.date,city:target.city,results:new Map([[1,{finishPosition:2}]])}
 assert.equal(mergeWinnerTargets([complete],[target],target.date)[0],complete)
 const staged=mergeWinnerTargets([],[target],target.date)[0];assert.equal(staged.results.get(6).finishPosition,null)
 assert.equal(mergeWinnerTargets([],[target],'2026-04-03').length,0)
})
test('winner target identity and result labels cannot enter model input features',()=>{
 const history=createRankingHistory(),a={...race,distance:'1200m',surface:'Çim',city:'Pakenham Avustralya',winnerOnly:true,winnerNo:1},b={...a,winnerNo:6,results:new Map([[6,{finishPosition:1}]])}
 assert.deepEqual(raceFeatures(a,'2026-04-02',history),raceFeatures(b,'2026-04-02',history))
})

import {sanitiseWinnerTarget} from './winner-only-target.mjs'
test('historical outcome retrieval cannot supply unverified target weather',()=>{const r=sanitiseWinnerTarget({...race,environment:{date:'2026-04-02',weather:'Rain'},weatherForecast:{rain:100},horses:[{...race.horses[0],sourceData:{tjk:{raceEnvironment:{weather:'Rain'}}}}]});assert.equal(r.environment,null);assert.equal(r.weatherForecast,null);assert.equal(r.horses[0].sourceData.tjk.raceEnvironment,undefined)})
