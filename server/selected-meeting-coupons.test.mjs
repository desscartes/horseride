import test from 'node:test'
import assert from 'node:assert/strict'
import {selectedMeetingCoupons} from './selected-meeting-coupons.mjs'
const date='2026-10-18',before='2026-10-18T05:00:00.000Z',later='2026-10-18T06:00:00.000Z'
const fixture=()=>Array.from({length:6},(_,i)=>({city:'Ankara',no:i+1,time:`${10+i}.00`,rankingSource:'local_trained_model',rankingMethod:'test-model',officialMarketsVerified:true,sixLegStarts:i===0?[1]:[],horses:Array.from({length:5},(_,n)=>({no:n+1,name:`HORSE ${i}-${n}`,probability:50-n*9}))}))
const doubleFixture=()=>Array.from({length:9},(_,i)=>({...fixture()[i%6],no:i+1,time:`${10+i}.00`,sixLegStarts:i===0?[1]:i===3?[2]:[],horses:fixture()[0].horses.map(h=>({...h,name:`R${i+1} ${h.name}`}))}))

test('each official game receives all tiers, independently optimal, including when first game was saved',()=>{
 const races=doubleFixture(),first=selectedMeetingCoupons(races.slice(0,6).map((r,i)=>({...r,sixLegStarts:i===0?[1]:[]})),date,'Ankara',[],{now:before}).map(r=>r.ticket)
 const rows=selectedMeetingCoupons(races,date,'Ankara',first,{now:later})
 assert.deepEqual(rows.map(r=>[r.ordinal,r.budget]),[[1,30],[1,50],[1,1000],[2,30],[2,50],[2,1000]])
 for(const row of rows){
  assert.equal(row.ticket.ordinal,row.ordinal)
  assert.equal(row.ticket.startRaceNo,row.ordinal===1?1:4)
  assert.ok(Math.abs(row.ticket.estimatedChance-row.ticket.legs.reduce((p,l)=>p*l.estimatedCoverage,1))<1e-12)
 }
 const secondOnly=selectedMeetingCoupons(races.slice(3),date,'Ankara',[],{now:later})
 assert.deepEqual(rows.slice(3).map(r=>r.ticket.legs),secondOnly.map(r=>r.ticket.legs))
 assert.deepEqual(rows.slice(0,3).map(r=>r.ticket.capturedAt),first.map(t=>t.capturedAt))
})

test('closed first game does not suppress later official game or invent a replacement',()=>{
 const rows=selectedMeetingCoupons(doubleFixture(),date,'Ankara',[],{now:'2026-10-18T08:00:00.000Z'})
 assert.ok(rows.filter(r=>r.ordinal===1).every(r=>r.ticket===null))
 assert.ok(rows.filter(r=>r.ordinal===2).every(r=>r.ticket?.startRaceNo===4))
})
test('city tiers are 30, 50 and wide; every leg carries a separate alternative',()=>{
 const rows=selectedMeetingCoupons(fixture(),date,'Ankara',[],{now:before})
 assert.deepEqual(rows.map(r=>r.budget),[30,50,1000]);assert.equal(rows[2].ticket.kind,'wide');assert.ok(rows[2].ticket.cost>=500&&rows[2].ticket.cost<=1000)
 for(const row of rows){assert.ok(row.ticket.cost<=row.budget);assert.equal(row.ticket.legs.length,6);assert.ok(row.ticket.legs.every(l=>l.surpriseSuggestion.available))}
})
test('wide ticket maximizes prefix coverage under 1000 TL instead of adding multiples',()=>{
 const races=fixture().map(r=>({...r,horses:r.horses.slice(0,4).map((h,i)=>({...h,probability:[51,26,15,8][i]}))})),wide=selectedMeetingCoupons(races,date,'Ankara',[],{now:before})[2].ticket
 let maximum=0
 function visit(leg,combinations,score){if(leg===6){maximum=Math.max(maximum,score);return}let mass=0;for(let n=1;n<=4;n++){mass+=races[leg].horses[n-1].probability/100;if(combinations*n*1.25<=1000)visit(leg+1,combinations*n,score*mass)}}visit(0,1,1)
 assert.ok(Math.abs(wide.estimatedChance-maximum)<1e-10);assert.equal(wide.multiples,1)
})
test('withdrawn selections get a linked pre-start revision and the saved row stays immutable',()=>{
 const races=fixture(),saved=selectedMeetingCoupons(races,date,'Ankara',[],{now:before}).map(r=>({...r.ticket,id:`saved-${r.budget}`})),original=JSON.stringify(saved)
 const victim=saved[0].legs[0].horses[0].number,changed=races.map(r=>r.no===1?{...r,horses:r.horses.filter(h=>h.no!==victim)}:r)
 const rows=selectedMeetingCoupons(changed,date,'Ankara',saved,{now:later})
 for(const row of rows){assert.ok(row.ticket);assert.match(row.ticket.algorithm,/-revision-/);assert.equal(row.ticket.supersedesTicketId,`saved-${row.budget}`);assert.ok(row.ticket.cost<=row.budget);assert.equal(row.ticket.legs[0].horses.some(h=>h.number===victim),false)}
 assert.equal(JSON.stringify(saved),original)
 const repeated=selectedMeetingCoupons(changed,date,'Ankara',[...saved,...rows.map(r=>r.ticket)],{now:'2026-10-18T06:05:00.000Z'})
 assert.deepEqual(repeated.map(r=>r.ticket.algorithm),rows.map(r=>r.ticket.algorithm));assert.deepEqual(repeated.map(r=>r.ticket.capturedAt),rows.map(r=>r.ticket.capturedAt))
})
test('a score change preserves a valid fixed ticket; a started invalid game cannot be rebuilt',()=>{
 const races=fixture(),saved=selectedMeetingCoupons(races,date,'Ankara',[],{now:before}).map(r=>r.ticket)
 const reranked=races.map(r=>({...r,horses:r.horses.map(h=>({...h,probability:100-h.probability}))}))
 const result=selectedMeetingCoupons(reranked,date,'Ankara',saved,{now:later}).map(r=>r.ticket)
 assert.deepEqual(result.map(t=>[t.algorithm,t.legs.map(l=>l.horses)]),saved.map(t=>[t.algorithm,t.legs.map(l=>l.horses)]))
 const removed=races.map(r=>({...r,horses:[]}))
 for(const row of selectedMeetingCoupons(removed,date,'Ankara',saved,{now:'2026-10-18T08:00:00.000Z'})){assert.equal(row.ticket,null);assert.match(row.reason,/oyunu başladı/)}
})
