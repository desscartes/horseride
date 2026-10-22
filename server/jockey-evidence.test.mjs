import {supplementCommentary} from './commentary-fallback.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {jockeyEvidence,jockeyResearchFeatures,jockeyResearchFeatureNames,jockeyComment,applyJockeyEvidence} from './jockey-evidence.mjs'
const race={city:'Ankara',surface:'Kum',distance:1400},horse={name:'AT',jockey:'A AP'}
const row={date:'2026-10-01',city:'Ankara',raceNo:1,horseName:'AT',jockey:'A',finishPosition:1,surface:'Kum',distance:1400}
test('jockey counts exclude current/future outcomes, other countries, duplicates and invalid results',()=>{
 const e=jockeyEvidence(race,horse,'2026-10-22',[row,row,{...row,date:'2026-10-22'},{...row,date:'2026-10-23'},{...row,city:'Keeneland ABD'},{...row,raceNo:2,finishPosition:0},{...row,raceNo:3,finishPosition:2}])
 assert.equal(e.starts,2);assert.equal(e.wins,1);assert.equal(e.topThree,2);assert.equal(e.partnership.starts,2);assert.equal(e.sameSurface.starts,2);assert.equal(e.sameDistance.starts,2);assert.equal(e.through,'2026-10-21');assert.equal(jockeyResearchFeatures(e).length,jockeyResearchFeatureNames.length)
})
test('zero evidence is missing rather than a zero quality rating; unknown rider never pools',()=>{
 const e=jockeyEvidence(race,horse,'2026-10-22',[]);assert.equal(e.starts,0);assert.equal(jockeyResearchFeatures(e).at(-1),1);assert.ok(jockeyResearchFeatures(e).every(Number.isFinite));assert.equal(jockeyEvidence(race,{jockey:'Bilinmiyor'},'2026-10-22',[row]),null)
})
test('comment identifies rider statistics and change without claiming a causal performance advantage',()=>{
 const h={...horse,jockeyPerformance:jockeyEvidence(race,horse,'2026-10-22',[row]),horsePerformance:{recentRuns:[{date:'2026-10-01',jockey:'B'}]}}
 const text=jockeyComment(h,'2026-10-22');assert.match(text,/90 günlük 1 yarışta 1 galibiyet/);assert.match(text,/Son 30/);assert.match(text,/B yerine bugün A AP/);assert.match(text,/örnek az/);assert.doesNotMatch(text,/kesin kazan|daha iyi jokey/)
 assert.match(jockeyComment({...h,jockeyPerformance:{...h.jockeyPerformance,through:'2026-10-22'}},'2026-10-22'),/istatistiği bu açıklamada bulunmuyor/)
})

test('cached jockey evidence never follows a rider change or crosses dates',()=>{
 const program={date:'2026-10-22',races:[{...race,no:1,horses:[horse]}]},snapshot={date:program.date,records:[{city:race.city,raceNo:1,horseName:horse.name,jockey:horse.jockey,evidence:jockeyEvidence(race,horse,program.date,[row])}]}
 assert.equal(applyJockeyEvidence(program,snapshot).races[0].horses[0].jockeyPerformance.starts,1)
 const changed={...program,races:[{...race,no:1,horses:[{...horse,jockey:'NEW'}]}]}
 assert.equal(applyJockeyEvidence(changed,snapshot).races[0].horses[0].jockeyPerformance,undefined)
 assert.strictEqual(applyJockeyEvidence(program,{...snapshot,date:'2026-10-21'}),program)
})

test('serving appends future jockey evidence without rewriting started predictions or pick order',()=>{
 const date='2099-10-22',h={...horse,jockeyPerformance:jockeyEvidence(race,horse,date,[{...row,date:'2099-10-01'}])},future={...race,no:1,time:'23:59',horses:[h]},past={...race,no:2,scheduledDate:'2020-01-01',time:'12:00',horses:[h]},program={date,races:[future,past]},current={date,city:race.city,createdAt:'original-time',analysis:{races:[{city:race.city,raceNo:1,picks:[{horseName:horse.name,reason:'Önceki kanıt'}]},{city:race.city,raceNo:2,picks:[{horseName:horse.name,reason:'Geçmiş yorum'}]}]}}
 const result=supplementCommentary(current,null,program,date,race.city)
 assert.equal(result.createdAt,'original-time');assert.match(result.analysis.races[0].picks[0].reason,/Önceki kanıt.*90 günlük/);assert.equal(result.analysis.races[1].picks[0].reason,'Geçmiş yorum');assert.equal(result.analysis.races[0].picks[0].horseName,horse.name)
 const repeat=supplementCommentary(result,null,program,date,race.city);assert.equal(repeat.analysis.races[0].picks[0].reason,result.analysis.races[0].picks[0].reason)
})
