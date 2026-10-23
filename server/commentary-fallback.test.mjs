import {analysisEntryFingerprint} from './analysis-entry-policy.mjs'
import test from 'node:test';import assert from 'node:assert/strict';import {emergencyCommentary,supplementCommentary} from './commentary-fallback.mjs'
const date='2026-10-22',now=new Date('2026-10-22T07:00:00Z'),h={no:1,name:'A',jockey:'J',trainer:'T',weight:55,start:1},p={date,races:[{city:'Geraldton Avustralya',no:5,time:'10:45',distance:'1113m',surface:'Çim',horses:[h,{...h,name:'B',no:2}]}]}
test('summary is available without model calls, rejects wrong day and started races',()=>{const r=emergencyCommentary(p,date,'Geraldton Avustralya',{now});assert.equal(r.analysis.races[0].raceNo,5);assert.equal(r.source,'automatic_verified_data_summary');assert.equal(r.analysisIsHistoricalForecast,false);assert.equal(emergencyCommentary(p,'2026-10-21','Geraldton Avustralya',{now}),null);assert.equal(emergencyCommentary(p,date,'Geraldton Avustralya',{now:new Date('2026-10-22T08:00:00Z')}),null)})
test('existing valid comments remain unchanged, stale horse identities are excluded',()=>{const f=emergencyCommentary(p,date,'Geraldton Avustralya',{now}),existing={date,city:'Geraldton Avustralya',analysis:{races:[{city:'Geraldton Avustralya',raceNo:5,picks:[{horseName:'A',reason:'Original'}]}]}};assert.equal(supplementCommentary(existing,f,p,date,existing.city),existing);const bad={...existing,analysis:{races:[{...existing.analysis.races[0],picks:[{horseName:'REMOVED'}]}]}};assert.ok(!supplementCommentary(bad,f,p,date,existing.city).analysis.races[0].picks.some(p=>p.horseName==='REMOVED'))})

test('rider changes invalidate a ready comment even when horse names stay identical',()=>{
 const original=structuredClone(p);original.date='2099-10-22';original.races[0].time='23:59'
 const existing={date:original.date,city:original.races[0].city,analysis:{entryFingerprints:{5:analysisEntryFingerprint(original.races)},races:[{city:original.races[0].city,raceNo:5,picks:[{horseName:'A',reason:'Eski jokey J ile üstün'}]}]}}
 const updated=structuredClone(original);updated.races[0].horses[0].jockey='NEW RIDER'
 const fallback=emergencyCommentary(updated,updated.date,existing.city,{now:new Date('2099-10-22T00:00:00Z')})
 const result=supplementCommentary(existing,fallback,updated,updated.date,existing.city)
 assert.doesNotMatch(result.analysis.races[0].picks[0].reason,/Eski jokey J ile üstün/);assert.match(result.analysis.races[0].picks[0].reason,/NEW RIDER/)
 assert.equal(result.analysis.entryFingerprints[5],analysisEntryFingerprint(updated.races))
})


test('workout response refresh replaces its old note and preserves started forecasts',()=>{
 const day='2099-10-22',city='Keeneland ABD',work={horseName:'A',dateISO:'2099-10-20',splits:{400:'0.26.20'}},program={date:day,races:[{city,no:1,time:'23:59',surface:'Kum',horses:[{name:'A',workouts:[work]}]}]}
 const old={date:day,city,analysis:{races:[{city,raceNo:1,picks:[{horseName:'A',reason:'Evidence. old note',workoutExplanationText:'old note'}]}]}}
 const result=supplementCommentary(old,null,program,day,city);const pick=result.analysis.races[0].picks[0];assert.doesNotMatch(pick.reason,/old note/);assert.match(pick.reason,/26,2/);assert.equal(supplementCommentary(result,null,program,day,city).analysis.races[0].picks[0].reason,pick.reason)
 const past={...old,date:'2020-10-22'};assert.equal(supplementCommentary(past,null,{...program,date:past.date,races:program.races.map(r=>({...r,time:'00:01'}))},past.date,city),past)
})
