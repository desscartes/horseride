import test from 'node:test'
import assert from 'node:assert/strict'
import {teamFeatures} from './team-features.mjs'
test('team features exclude target day, other teams and duplicate starts; known nonfinishers count',()=>{
 const horse={name:'Alpha',jockey:'Rider',trainer:'Trainer'},old={date:'2026-01-01',city:'A',raceNo:1,horseName:'Alpha',jockey:'Rider',trainer:'Trainer',finishPosition:1}
 const f=teamFeatures(horse,'2026-01-03',[old,old,{...old,date:'2026-01-03'},{...old,trainer:'Other'},{...old,date:'2026-01-02',finishPosition:0}]);assert.deepEqual(f,[2,2/12,2,2/12,0]);assert.deepEqual(teamFeatures({...horse,trainer:''},'2026-01-03',[old]),[0,.1,0,.1,1])
})
