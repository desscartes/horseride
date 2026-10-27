import {analysisEntryFingerprint} from './analysis-entry-policy.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {instagramMeetingPlan} from './instagram-meeting-plan.mjs'
const now='2026-10-27T06:00:00Z',program={date:'2026-10-27',fetchedAt:now,races:Array.from({length:6},(_,i)=>({city:'Ankara',no:i+1,time:`${10+i}.00`,rankingSource:'local_trained_model',rankingMethod:'test',officialMarketsVerified:true,sixLegStarts:i===0?[1]:[],horses:[{no:1,name:'A',probability:65,marketShare:60,jockey:'J',weight:55,start:1},{no:2,name:'B',probability:25,marketShare:30},{no:3,name:'C',probability:10,marketShare:10}]}))},readiness={sourceFetchedAt:program.fetchedAt,entryFingerprint:analysisEntryFingerprint(program.races),date:program.date,checkedAt:now,races:program.races.map(r=>({city:r.city,raceNo:r.no,start:`2026-10-27T${String(7+r.no-1).padStart(2,'0')}:00:00.000Z`,servingReady:true,verifiedModelAvailable:true,coreReady:true,coverageKnown:true,missing:[]}))}
test('one city package chooses a valid coupon, single leader and eligible outsider',()=>{const r=instagramMeetingPlan(program,readiness,{now});assert.equal(r.drafts.length,1);assert.equal(r.drafts[0].first.name,'A');assert.equal(r.drafts[0].surprise.name,'C');assert.ok(r.drafts[0].ticket.cost<=50)})
test('stale, incomplete, withdrawn and started data cannot be published',()=>{assert.equal(instagramMeetingPlan({...program,fetchedAt:'2026-10-26T23:00:00Z'},readiness,{now}).drafts.length,0);const gap=structuredClone(readiness);gap.races[1].verifiedModelAvailable=false;assert.equal(instagramMeetingPlan(program,gap,{now}).drafts.length,0);assert.equal(instagramMeetingPlan(program,readiness,{now:'2026-10-27T06:45:00Z'}).drafts.length,0);const p=structuredClone(program);p.races[0].horses[2].outOfRace=true;assert.equal(instagramMeetingPlan(p,readiness,{now}).drafts.length,0)})

test('early programs and limited optional evidence can publish, but known core defects cannot',()=>{
 const p=structuredClone(program);p.races=p.races.map(r=>({...r,time:`${15+r.no}.00`}))
 const ready=structuredClone(readiness);ready.sourceFetchedAt=p.fetchedAt;ready.entryFingerprint=analysisEntryFingerprint(p.races);ready.races=ready.races.map(r=>({...r,start:`2026-10-27T${String(13+r.raceNo-1).padStart(2,'0')}:00:00.000Z`,servingReady:false,missing:[{name:'B',missing:['workout','damsire','jockeySampleSize']}]}))
 const r=instagramMeetingPlan(p,ready,{now});assert.equal(r.drafts.length,1);assert.equal(r.drafts[0].tier,'limited_data');assert.match(r.drafts[0].caption,/Sınırlı veri/);assert.equal(r.drafts[0].phase,'Erken program analizi')
 ready.races[0].coreReady=false;assert.equal(instagramMeetingPlan(p,ready,{now}).drafts.length,0)
})
test('a second official six-leg game remains eligible after the city has begun',()=>{
 const p=structuredClone(program);p.races=p.races.map(r=>({...r,no:r.no+2,time:`${10+r.no}.00`,sixLegStarts:r.no===1?[2]:[]}));p.races.unshift({city:'Ankara',no:1,time:'08.00',horses:[]})
 const ready=structuredClone(readiness);ready.entryFingerprint=analysisEntryFingerprint(p.races);ready.races=ready.races.map(r=>({...r,raceNo:r.raceNo+2,start:`2026-10-27T${String(8+r.raceNo-1).padStart(2,'0')}:00:00.000Z`}))
 const r=instagramMeetingPlan(p,ready,{now});assert.equal(r.drafts.length,1);assert.equal(r.drafts[0].ticket.ordinal,2)
})

test('fresh official confirmation is bound to saved inputs and all future legs',()=>{
 const p=structuredClone(program);p.fetchedAt='2026-10-27T04:00:00Z';const r=structuredClone(readiness);r.sourceFetchedAt=p.fetchedAt;
 const proof={city:'Ankara',confirmed:true,checkedAt:now,originalProgramFetchedAt:p.fetchedAt,entryFingerprint:analysisEntryFingerprint(p.races),raceNumbers:[1,2,3,4,5,6]};
 assert.equal(instagramMeetingPlan(p,r,{now}).drafts.length,0);
 assert.equal(instagramMeetingPlan(p,r,{now,confirmation:{cities:[proof]}}).drafts.length,1);
 for(const patch of [{originalProgramFetchedAt:now},{entryFingerprint:'wrong'},{raceNumbers:[1,2,3,4,5]},{checkedAt:'2026-10-27T04:00:00Z'}])assert.equal(instagramMeetingPlan(p,r,{now,confirmation:{cities:[{...proof,...patch}]}}).drafts.length,0);
});
