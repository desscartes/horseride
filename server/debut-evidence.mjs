import {workoutEvidence} from './workout-evidence.mjs'
export function debutEvidence(horse,date){
 const past=horse.horsePerformance?.pastRuns||horse.horsePerformance?.recentRuns||[]
 const observed=past.filter(r=>r.date<date&&Number(r.finishPosition)>0).length
 const verifiedZero=horse.australianEvidence?.career?.starts===0
 const status=observed?'observed_prior_start':verifiedZero?'verified_debut':'career_unverified'
 const workouts=workoutEvidence(horse,date),jockey=Number(horse.jockeyPerformance?.starts)||0
 return {status,identityConflict:verifiedZero&&observed>0,observedStarts:observed,workoutRecords:workouts.rows.length,knownSire:Boolean(horse.sire),knownDam:Boolean(horse.dam),jockeyObservedStarts:jockey,missingIsPoorForm:false,note:status==='verified_debut'?'İlk startı doğrulandı; yarış geçmişi yerine doğrulanmış hazırlık ve soy verileri değerlendirilmeli.':status==='career_unverified'?'Kariyer doğrulanamadı; ilk kez koştuğu veya formsuz olduğu çıkarılamaz.':'Önceki start kaydı var; ilk kez koşan olarak değerlendirilmez.'}
}
