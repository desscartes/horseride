import test from 'node:test'
import assert from 'node:assert/strict'
import {selectHistoricalMeetings} from './historical-meeting-selection.mjs'
const meetings=[{city:'İzmir',foreign:false,url:'local'},{city:'Cranbourne Avustralya',foreign:true,url:'au'},{city:'Belmont Park ABD',foreign:true,url:'us'},{city:'Northam Avustralya',foreign:true}]
test('default selection retains domestic collection semantics',()=>assert.deepEqual(selectHistoricalMeetings(meetings).map(m=>m.url),['local']))
test('AU collection cannot pull US or domestic meetings and requires a source URL',()=>assert.deepEqual(selectHistoricalMeetings(meetings,{foreignOnly:true,countries:['AU']}).map(m=>m.url),['au']))
test('unsupported country filters fail explicitly',()=>assert.throws(()=>selectHistoricalMeetings(meetings,{countries:['ZZ']}),/Unsupported/))