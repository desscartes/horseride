import test from 'node:test'
import assert from 'node:assert/strict'
import {fluentHorseReason,enrichCommentaryRace,commentaryModelCaution} from './commentary-evidence.mjs'
test('fluent reasons use prior facts, distinguish weight change, and preserve candidate order',()=>{
 const a={name:'A',weight:58,horsePerformance:{recentRuns:[{date:'2026-10-10',finishPosition:2,weight:56,distance:1200,surface:'Kum'},{date:'2026-10-18',finishPosition:1}],sameDistanceAndSurface:{starts:4,wins:1,topThree:3}}},b={name:'B',horsePerformance:{sameDistanceAndSurface:{starts:5,wins:2,topThree:3}}}
 const race={city:'Ankara',surface:'Kum',distance:1400,horses:[a,b]},prediction={picks:[{horseName:'A'},{horseName:'B'}],risks:[]}
 const reason=fluentHorseReason(race,a,'2026-10-17',b)
 assert.match(reason,/2 kilo daha ağır/);assert.match(reason,/B aynı koşullardaki 5/);assert.doesNotMatch(reason,/2026-10-18|garantili/)
 const result=enrichCommentaryRace(race,prediction,'2026-10-17');assert.deepEqual(result.picks.map(p=>p.horseName),['A','B']);assert.equal(result.explanationRevision,'evidence-v3-fluent')
})
test('missing history does not become debut or invented form',()=>{
 const reason=fluentHorseReason({surface:'Çim',distance:1600},{name:'X'},'2026-10-17')
 assert.match(reason,/geçmişi sınırlı/);assert.doesNotMatch(reason,/ilk yarış start|0 galibiyet|kazanacak/)
})
test('Malaysian program scoring cannot be presented as a high-confidence trained model',()=>{
 const caution=commentaryModelCaution({city:'Selangor Malezya'},{confidence:'high',risks:[]})
 assert.equal(caution.confidence,'low');assert.match(caution.risks[0],/Malezya.*etkin model yok/)
 assert.deepEqual(commentaryModelCaution({city:'Belmont Park ABD',rankingSource:'local_trained_model'},{confidence:'high'}),{})
})
