import test from 'node:test';import assert from 'node:assert/strict';import {prestartRefreshJob} from './prestart-refresh-plan.mjs'
const date='2026-10-22',now=new Date('2026-10-22T06:00:00Z'),p={date,fetchedAt:'2026-10-22T05:00:00Z',races:[{time:'09:37'}]}
test('imminent races get bounded priority refresh, fresh and completed slots do not',()=>{const j=prestartRefreshJob(p,date,now);assert.equal(j.script,'server/run-prestart-readiness.mjs');assert.equal(prestartRefreshJob({...p,fetchedAt:'2026-10-22T05:50:00Z'},date,now),null);assert.equal(prestartRefreshJob(p,date,now,{[j.id]:{status:'complete'}}),null);assert.equal(prestartRefreshJob(p,date,new Date('2026-10-22T06:38:00Z')),null);assert.equal(prestartRefreshJob({...p,date:'2026-10-21'},date,now),null)})

test('last 30 minutes use ten minute refresh age',()=>{const near={...p,races:[{time:"09:20"}],fetchedAt:"2026-10-22T05:45:00Z"};assert.ok(prestartRefreshJob(near,date,now));assert.equal(prestartRefreshJob({...near,fetchedAt:"2026-10-22T05:55:00Z"},date,now),null)})

test('early published programs refresh hours before start without requiring a one-hour window',()=>{const early={...p,races:[{time:'18:00'}],fetchedAt:'2026-10-22T02:00:00Z'};assert.ok(prestartRefreshJob(early,date,now));assert.equal(prestartRefreshJob({...early,fetchedAt:'2026-10-22T05:00:00Z'},date,now),null)})
