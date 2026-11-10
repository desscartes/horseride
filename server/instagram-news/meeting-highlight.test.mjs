import test from 'node:test'
import assert from 'node:assert/strict'
import { meetingHighlight } from './meeting-highlight.mjs'

test('highlights a ranked race only when its leading horse has dated prior evidence', () => {
  const facts = { races: [
    { raceNo: 1, leadMargin: 9, horses: [{ name: 'KAYITSIZ' }, { name: 'RAKİP' }] },
    { raceNo: 2, leadMargin: 4, horses: [{ name: 'ŞİLEM', lastRun: '12.06.36’da Ankara’da 1. oldu.' }, { name: 'İKİNCİ' }] },
  ] }
  const text = meetingHighlight(facts)
  assert.match(text, /2\. koşuda ilk sıradaki ŞİLEM/)
  assert.match(text, /12\.06\.36/)
  assert.doesNotMatch(text, /KAYITSIZ/)
})

test('does not invent a meeting highlight without verified run or workout evidence', () => {
  assert.equal(meetingHighlight({ races: [{ raceNo: 1, leadMargin: 5, horses: [{ name: 'A' }, { name: 'B' }] }] }), null)
})
