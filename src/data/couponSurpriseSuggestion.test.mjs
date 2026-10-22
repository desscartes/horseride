import test from 'node:test'
import assert from 'node:assert/strict'
import {legSurpriseSuggestion} from './couponSurpriseSuggestion.js'
const fixture=()=>({horses:Array.from({length:5},(_,i)=>({no:i+1,name:'H'+i,probability:50-i*9,marketShare:40-i*8}))})
test('every normal field gets an outside-main alternative; favorite and withdrawn labels stay truthful',()=>{
 const race=fixture(),prediction={picks:[{horseName:'H0'},{horseName:'H1'}]}
 assert.equal(legSurpriseSuggestion(race,prediction).number,3)
 const missing={...race,horses:race.horses.map(h=>({...h,marketShare:undefined}))}
 assert.equal(legSurpriseSuggestion(missing,prediction).status,'model_alternative')
 race.horses[2].outOfRace=true;assert.notEqual(legSurpriseSuggestion(race,prediction).number,3)
 assert.equal(legSurpriseSuggestion({horses:race.horses.slice(0,2)},prediction).available,false)
})

test('alternative gives actual card evidence without inventing a win probability',()=>{
 const race=fixture();race.horses[2]={...race.horses[2],lastSix:'362116',weight:51.5,start:10}
 const result=legSurpriseSuggestion(race,{picks:[{horseName:'H0'},{horseName:'H1'}]})
 assert.equal(result.horseName,'H2');assert.match(result.reason,/2 galibiyet, 4 ilk üç/);assert.match(result.reason,/51,5 kilo/);assert.doesNotMatch(result.reason,/%|kazanacak/)
})
