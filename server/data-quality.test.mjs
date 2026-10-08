import test from 'node:test'
import assert from 'node:assert/strict'
import {parseWeight,parseRaceTime,horseIdentity,analysisFingerprint} from './data-quality.mjs'

test('weight additions are summed and impossible or ambiguous values are rejected',()=>{
  for(const [input,expected] of [['60 +0.2',60.2],['52 +2.00',54],['57,5',57.5],[60,60],['600.2',null],['',null],['60 2',null],['30',null]])assert.equal(parseWeight(input),expected)
})
test('time parsing validates seconds and preserves hundredths',()=>{
  assert.equal(parseRaceTime('1.28.55'),88.55)
  assert.equal(parseRaceTime('1:28:5'),88.5)
  assert.equal(parseRaceTime('1.99.12'),null)
})
test('identity survives equipment changes but preserves different horse names',()=>{
  assert.equal(horseIdentity('GÜLNARLI KG DB'),horseIdentity('Gülnarlı K'))
  assert.notEqual(horseIdentity('GÜLNARLI'),horseIdentity('GÜLNAR'))
})
test('fingerprint ignores relative scores and order but detects program changes',()=>{
  const race={city:'Bursa',no:1,time:'14.30',horses:[{no:1,name:'A',weight:55,jockey:'J',probability:10},{no:2,name:'B',weight:57,jockey:'K'}]}
  const key=analysisFingerprint([race])
  assert.equal(key,analysisFingerprint([{...race,horses:[race.horses[1],{...race.horses[0],probability:99}]}]))
  for(const horses of [[{...race.horses[0],weight:56},race.horses[1]],[{...race.horses[0],jockey:'L'},race.horses[1]],[race.horses[0]]])assert.notEqual(key,analysisFingerprint([{...race,horses}]))
})
