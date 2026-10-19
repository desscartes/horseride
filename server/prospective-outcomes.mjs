import {resolvedRunnerResult} from './result-status.mjs'
export function prospectiveOutcome(race,results){
 const finish=new Map()
 for(const horse of race.horses||[]){
  const result=results.get(Number(horse.no))||results.get(horse.no)
  // Official non-finisher (0) is a known loser. Missing result stays missing.
  if(resolvedRunnerResult(result))finish.set(horse.name,result.finishPosition)
 }
 return finish
}
