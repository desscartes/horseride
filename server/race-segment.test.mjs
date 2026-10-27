import test from 'node:test'
import assert from 'node:assert/strict'
import {raceSegment} from './race-segment.mjs'
test('race type segmentation never infers debut from missing history',()=>{assert.equal(raceSegment({type:'Handikap 16'}),'handicap');assert.equal(raceSegment({type:'Maiden'}),'maiden_or_debut_eligible');assert.equal(raceSegment({type:'Şartlı 1'}),'maiden_or_debut_eligible');assert.equal(raceSegment({}),'unknown')})
