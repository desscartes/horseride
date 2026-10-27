import {shiftDay} from './maintenance-policy.mjs';
export function performanceSummary(reports,through){
 return {through,periods:[7,30].map(days=>{
  const from=shiftDay(through,1-days),selected=reports.filter(r=>r.date>=from&&r.date<=through),sum=field=>selected.reduce((n,r)=>n+(r.result[field]||0),0);
  const settled=sum('settled'),surprises=sum('surpriseEvaluated');
  return {days,from,through,publishedMeetings:sum('meetings'),settledMeetings:settled,pendingMeetings:sum('pending'),excludedMeetings:sum('excluded'),coupon:{hits:sum('couponWins'),evaluated:settled},first:{hits:sum('firstWins'),evaluated:settled},surprise:{hits:sum('surpriseWins'),evaluated:surprises}};
 }),note:'Only prestart verified published selections. All wins and losses retained. Pending and excluded meetings are separate; no return or future-success claim.'};
}
