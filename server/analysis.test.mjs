import test from 'node:test'
import assert from 'node:assert/strict'
process.env.HORSERIDE_NO_LISTEN = '1'
const { parseAnalysisOutput, summarizeHorsePerformance, buildHistoricalAnalysisContext } = await import('./index.mjs')
const horses = ['A', 'B', 'C', 'D', 'E'].map((name,horsesIndex) => ({ name, marketShare: 40 - 8 * horsesIndex }))
const races = [{ city: 'Adana', no: 1, horses }]
const valid = () => ({ summary: 'Veriye dayalı analiz.', races: [{ city: 'Adana', raceNo: 1, confidence: 'low', risks: [], picks: horses.slice(0,4).map((horse) => ({ horseName: horse.name, reason: 'Mesafe uyumu var. Rakip geçmişi sınırlı. İdman verisi yok.' })) }] })
test('requires four unique, current-program horses with detailed reasons', () => {
  assert.equal(parseAnalysisOutput(JSON.stringify(valid()), races).races[0].picks.length, 4)
  for (const mutate of [v => v.races[0].picks.pop(), v => v.races[0].picks[1].horseName='A', v => v.races[0].picks[1].horseName='Unknown', v => v.races[0].picks[1].reason='Tek cümle.']) {
    const v = valid(); mutate(v); assert.throws(() => parseAnalysisOutput(JSON.stringify(v), races))
  }
})
test('rejects duplicate or omitted races', () => {
  const v=valid(); v.races.push(v.races[0]); assert.throws(() => parseAnalysisOutput(JSON.stringify(v),races))
  v.races=[]; assert.throws(() => parseAnalysisOutput(JSON.stringify(v),races))
})

test('surprise must be a current runner outside the first two with evidence', () => {
  const v=valid()
  v.races[0].surprise={horseName:'E',reason:'Aynı mesafe ve pistte geçmiş uyumu var. Rakiplerine göre son formu zayıf, ancak hafif kilosu alternatif oluşturuyor.'}
  assert.equal(parseAnalysisOutput(JSON.stringify(v),races).races[0].surprise.horseName,'E')
  for (const surprise of [{...v.races[0].surprise,horseName:'A'},{...v.races[0].surprise,horseName:'Unknown'},{horseName:'E',reason:'Kısa.'}]) {
    const invalid=valid();invalid.races[0].surprise=surprise
    assert.throws(()=>parseAnalysisOutput(JSON.stringify(invalid),races))
  }
  v.races[0].surprise=null
  assert.equal(parseAnalysisOutput(JSON.stringify(v),races).races[0].surprise,null)
})
test('decimal times do not count as full explanation sentences', () => {
  const v=valid();v.races[0].picks[0].reason='1.28.55 ve 1.29.22 derecelerle koştu.'
  assert.throws(()=>parseAnalysisOutput(JSON.stringify(v),races))
})

test('an AGF favorite outside the AI first two loses only its surprise label',()=>{
 const v=valid();v.races[0].surprise={horseName:'E',reason:'Aynı mesafe ve pistte geçmiş uyumu var. Hafif kilo alternatif oluşturuyor, ancak formu belirsiz.'}
 const changed=[{...races[0],horses:horses.map(h=>({...h,marketShare:h.name==='E'?80:5}))}]
 const result=parseAnalysisOutput(JSON.stringify(v),changed).races[0]
 assert.equal(result.surprise,null)
 assert.deepEqual(result.picks.map(p=>p.horseName),['A','B','C','D'])
})
test('excludes target and future results and preserves surface, distance and class', () => {
  const headers=['Tarih','Şehir','Msf','Pist','S','Derece','Sıklet','Jokey','St','K. No-K. Adı','Kcins','HP']
  const row=(date,finish)=>[date,'Adana','1400','K:Normal',finish,'1.28.55','55','J','3','2','Maiden','42']
  const result=summarizeHorsePerformance([{headers,rows:[row('04.10.2026','1'),row('05.10.2026','1'),row('03.10.2026','4')]}],'2026-10-04','A')
  assert.equal(result.starts,1);assert.equal(result.pastRuns[0].finishPosition,4)
  assert.equal(result.pastRuns[0].surface,'kum');assert.equal(result.pastRuns[0].distance,1400)
  assert.equal(result.pastRuns[0].className,'Maiden')
})
test('filters future workouts and only compares same distance and surface together', () => {
  const race={...races[0],distance:'1400m',surface:'Kum',horses:[{name:'Synthetic horse',jockey:'Unknown jockey',workout:{date:'05.10.2026'},horsePerformance:{pastRuns:[{date:'2026-10-03',distance:1400,surface:'cim',finishPosition:1},{date:'2026-10-02',distance:1400,surface:'kum',finishPosition:4},{date:'2026-10-04',distance:1400,surface:'kum',finishPosition:1}]}}]}
  const horse=buildHistoricalAnalysisContext([race],'2026-10-04')[0].horses[0]
  assert.equal(horse.horsePerformance.sameDistanceAndSurface.starts,1)
  assert.equal(horse.horsePerformance.recentRuns.length,2);assert.equal(horse.workout,null)
  assert.ok(horse.horsePerformance.recentRuns.every(run=>!run.competition))
})
