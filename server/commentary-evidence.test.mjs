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
 assert.match(reason,/önceki yarış sonucu bulunmuyor/);assert.doesNotMatch(reason,/ilk yarış start|0 galibiyet|kazanacak/)
})
test('Malaysian program scoring cannot be presented as a high-confidence trained model',()=>{
 const caution=commentaryModelCaution({city:'Selangor Malezya'},{confidence:'high',risks:[]})
 assert.equal(caution.confidence,'low');assert.match(caution.risks[0],/Malezya.*etkin model yok/)
 assert.deepEqual(commentaryModelCaution({city:'Belmont Park ABD',rankingSource:'local_trained_model'},{confidence:'high'}),{})
})

test('baseline explanation compares actual card facts without inventing career or probability',()=>{
 const a={name:'SNEAKY',lastSix:'362116',weight:51.5,start:10},b={name:'FIRE',lastSix:'125225',weight:57.5,start:3}
 const reason=fluentHorseReason({rankingSource:'program_baseline',horses:[a,b]},a,'2026-10-22',b)
 assert.match(reason,/2 galibiyet ve 4 ilk üç/);assert.match(reason,/6 kilo fark/);assert.match(reason,/sonuç dizisi -2,2 puan/);assert.match(reason,/kilo bileşeni \+6,4 puan/);assert.match(reason,/Start yeri 10/);assert.doesNotMatch(reason,/son yarışını.*kazandı|%/)
})

test('unraced explanations use dated preparation facts and never treat missing history as poor form',()=>{
 const race={surface:'Kum',distance:1200,horses:[]},h={name:'X',sire:'SIRE',dam:'DAM',weight:56,start:2,workouts:[{dateISO:'2026-10-20',hippodrome:'İzmir',surface:'Kum',splits:{400:'25.0'}},{dateISO:'2026-10-23',splits:{400:'20.0'}}]}
 const text=fluentHorseReason(race,h,'2026-10-23');assert.match(text,/1 kayıtlı idmanı/);assert.match(text,/baba SIRE, anne DAM/);assert.doesNotMatch(text,/gelişim kanıtı sunmuyor|2026-10-23|20 saniye|form ve pist uyumu hakkında güçlü/)
 const debut=fluentHorseReason(race,{...h,australianEvidence:{career:{starts:0}}},'2026-10-23');assert.match(debut,/ilk startına çıkıyor/)
})
