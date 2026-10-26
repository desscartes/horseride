import test from 'node:test'
import assert from 'node:assert/strict'
import {matchingAustralianProfile,enrichAustralianRaces,parseAustralianForm} from './australian-form.mjs'
import {australianFeatures} from './australian-features.mjs'
const horse={no:2,name:'TEST (AUS) DB',sire:'SIRE (GB)',dam:'DAM (AUS)'}
const race={city:'Cranbourne Avustralya',no:1,surface:'Çim',distance:'1000m',horses:[horse]}
const profile={date:'2026-10-16',city:race.city,raceNo:1,no:2,name:'TEST',sire:'SIRE',dam:'DAM',horseCode:'official-code',career:{starts:0},pastRuns:[],trials:[{date:'2026-10-15',distance:800,fieldSize:6,finishPosition:2},{date:'2026-10-16',distance:800},{date:'2026-10-17',distance:800}]}
const snapshots=[{date:profile.date,city:race.city,runners:[profile]}]
test('AU profiles require date, race, number, name and both parents',()=>{
 assert.ok(matchingAustralianProfile(race,horse,'2026-10-16',snapshots))
 assert.equal(matchingAustralianProfile(race,{...horse,dam:'OTHER'},'2026-10-16',snapshots),null)
 assert.equal(matchingAustralianProfile(race,horse,'2026-10-15',snapshots),null)
 assert.equal(matchingAustralianProfile(race,horse,'2026-10-16',[...snapshots,...snapshots]),null)
})
test('same-day/future trials excluded and trials never become race starts or runner speed',()=>{
 const [r]=enrichAustralianRaces([race],'2026-10-16',{snapshots})
 assert.equal(r.horses[0].trialEvidence.length,1)
 const f=australianFeatures(r,'2026-10-16')[0]
 assert.equal(f[1],0);assert.equal(f[7],1);assert.equal(f[9],1)
})
test('source date mismatch is rejected',()=>{
 assert.throws(()=>parseAustralianForm('<span class="race-venue-date">15 October 2026</span>',{date:'2026-10-16',city:race.city,sourceUrl:'https://www.racingaustralia.horse/'}),/date mismatch/)
})
test('official parser keeps winner time separate and excludes target-day records',()=>{
 const html=`<span class="race-venue-date">Friday, 16 October 2026</span><table class="race-title"><tr><td class="raceNum">Race 1</td></tr></table><table class="horse-form-table"><tr><td><div class="horse-info"><span class="horse-number">2</span><span class="horse-name"><a href="/InteractiveForm/HorseFullForm.aspx?horsecode=abc">TEST</a></span><span class="plain"><a class="GreenLink">SIRE</a><a class="GreenLink">DAM</a><a class="GreenLink">DAMSIRE</a></span></div>Record: 1:0-1-0<table class="horse-last-start"><tr><td class="Pos">2 of 8</td><td class="remain"><a href="Meeting.aspx?racecode=old">CRAN 01Oct26</a> 1000m Good4 MDN-SW $45000 <a href="JockeyLastRuns.aspx?jockeycode=1">JOCKEY</a> 56kg Barrier 2<br>1st WINNER 56kg 0:58.31</td></tr><tr><td class="Pos">1 of 8</td><td class="remain"><a href="Meeting.aspx?racecode=target">CRAN 16Oct26</a> 1000m Good4 $45000 56kg<br>0:57.00</td></tr></table></td></tr></table>`
 const s=parseAustralianForm(html,{date:'2026-10-16',city:race.city,sourceUrl:'https://www.racingaustralia.horse/FreeFields/AllForm.aspx'})
 assert.equal(s.runners[0].pastRuns.length,1)
 assert.equal(s.runners[0].pastRuns[0].timeSeconds,null)
 assert.equal(s.runners[0].pastRuns[0].winnerTimeSeconds,58.31)
 assert.equal(s.runners[0].damsire,'DAMSIRE')
})

import {maidenEvidence} from './maiden-evidence.mjs'
import {enrichCommentaryRace} from './commentary-evidence.mjs'
test('verified debut with trials is distinguished from missing career and routine workouts',()=>{
 const r={...race,type:'Maiden'},h={...horse,australianEvidence:profile,trialEvidence:[profile.trials[0]],horsePerformance:{recentRuns:[]}}
 const e=maidenEvidence(r,h,'2026-10-16')
 assert.match(e.text,/ilk startına/)
 assert.match(e.text,/deneme koşuları ayrı/)
 assert.doesNotMatch(e.text,/Yakın dönem idman kaydı eksik/)
 const prediction=enrichCommentaryRace({...r,horses:[h],rankingSource:'program_baseline'},{picks:[{horseName:h.name}],confidence:'high',risks:[]},'2026-10-16')
 assert.equal(prediction.confidence,'low')
 assert.match(prediction.picks[0].reason,/ilk (?:yarış )?startına/)
})

import {australianSurface} from './australian-form.mjs'
test('unknown Australian surfaces cannot silently become turf',()=>{assert.equal(australianSurface('1000m Unknown track'),null);assert.equal(australianSurface('800m Jump Out - G4'),'Çim');assert.equal(australianSurface('1000m Dirt'),'Kum');assert.equal(australianSurface('750m JumpOut - Synth'),'Sentetik')})
