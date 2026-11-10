import test from 'node:test';import assert from 'node:assert/strict';
import {matchStoryVenue,venueStoryPlan} from './venue-history.mjs';
const day='2026-11-02',now=Date.parse(day+'T14:00:00+03:00');
const story={interestingStory:true,venueAliases:['Wolverhampton'],venueLabel:'Wolverhampton Hipodromu',year:1993,storySegments:[{text:'Bir.'},{text:'İki.'},{text:'Üç.'}]};
const program={races:[{city:'Wolverhampton Birleşik Krallık',time:'19.30',scheduledDate:day}]};
test('exact venue is eligible before racing, without using country-only matching',()=>{assert.equal(matchStoryVenue(story,program,day,now).city,program.races[0].city);assert.equal(matchStoryVenue({...story,venueAliases:['Epsom']},program,day,now),null)});
test('legacy winner entries and finished meetings cannot produce a today opening',()=>{assert.equal(matchStoryVenue({country:'GB'},program,day,now),null);assert.equal(matchStoryVenue(story,program,day,Date.parse(day+'T20:00:00+03:00')),null)});
test('a next-day race is not described as today',()=>{assert.equal(matchStoryVenue(story,{races:[{...program.races[0],scheduledDate:'2026-11-03'}]},day,now),null)});
test('opening and narrated beats carry the actual selected venue',()=>{const plan=venueStoryPlan(story,{city:program.races[0].city},day);assert.ok(plan.narration.startsWith('Bugün yarış koşulacak Wolverhampton Hipodromu için, 1993'));assert.equal(plan.narrationSegments.map(s=>s.text).join(' '),plan.narration)});
