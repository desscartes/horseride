process.env.HORSERIDE_NO_LISTEN='1'
import {acquireCollectionGate} from './collection-gate.mjs'
import {writeFile} from 'node:fs/promises'
import {localDay} from './maintenance-policy.mjs'
import {readServedProgram} from './served-program.mjs'
import {workoutEvidence} from './workout-evidence.mjs'
import {racingCountry} from './foreign-data.mjs'
await acquireCollectionGate()
const {collectHorseWorkouts}=await import('./index.mjs')
const {getProgramForAnalysis}=await import('./database.mjs')
const day=localDay(),program=readServedProgram(day)
if(!program?.races?.length)throw Error('Current program must be published first')
// Workout availability needs current profiles, not the full historical model context.
const races=getProgramForAnalysis(day,'Tümü'),reports=[]
let remaining=60
for(const race of races.filter(r=>!racingCountry(r.city))){
 const ids=race.horses.filter(h=>!h.outOfRace&&!workoutEvidence(h,day).rows.length).map(h=>h.horseId).filter(Boolean).slice(0,remaining)
 if(!ids.length)continue
 reports.push(await collectHorseWorkouts(day,race.city,ids.length,{horseIds:ids}));remaining-=ids.length;if(!remaining)break
}
const report={day,checkedAt:new Date().toISOString(),reports,scope:'Bounded official profiles for at most 60 current domestic runners without prior workouts; missing is not fabricated'}
await writeFile('data/maintenance/current-workouts.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report))
