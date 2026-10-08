import test from 'node:test'
import assert from 'node:assert/strict'
import { orderAnalysisHorses, findRacePrediction } from './analysisView.js'

const horses = [{ name: 'BALKIZIM', probability: 14 }, { name: 'GÜLNARLI', probability: 13 }, { name: 'İZOTOP', probability: 11 }]
const prediction = { city: 'Bursa', raceNo: 1, picks: [{ horseName: 'GÜLNARLI', reason: 'Geçmiş pist uyumu.' }, { horseName: 'İZOTOP' }] }
test('AI leader overrides basic-score order without inventing percentages', () => {
  const result = orderAnalysisHorses(horses, prediction)
  assert.equal(result[0].name, 'GÜLNARLI')
  assert.equal(result[0].aiRank, 1)
  assert.equal(result[0].probability, 13)
  assert.equal(result.at(-1).aiRank, null)
  assert.equal(horses[0].name, 'BALKIZIM')
})
test('missing AI preserves basic order; withdrawn candidates are omitted', () => {
  assert.equal(orderAnalysisHorses(horses, null)[0].name, 'BALKIZIM')
  assert.equal(orderAnalysisHorses(horses.filter(horse => horse.name !== 'GÜLNARLI'), prediction)[0].name, 'İZOTOP')
})
test('predictions are scoped to city and race number', () => {
  assert.equal(findRacePrediction([prediction], { city: 'Bursa', no: 1 }), prediction)
  assert.equal(findRacePrediction([prediction], { city: 'Adana', no: 1 }), null)
})
