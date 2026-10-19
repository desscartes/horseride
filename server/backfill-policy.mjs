import {shiftDay} from './maintenance-policy.mjs'
import {historicalDayComplete} from './history-completeness.mjs'
const valid=day=>/^\d{4}-\d{2}-\d{2}$/.test(day||'')
export function backfillGaps(previous={}){return [...new Set([...(previous.failedDates||[]),...(previous.gapBacklog||[])].filter(valid))].sort()}
export function chooseBackfillBatch({first,target,previous={}}){
 if(!valid(first)||!valid(target))return null
 let through=shiftDay(first,-1),days=14
 if(valid(previous.nextThrough)){
  if(previous.status==='partial'&&Number.isInteger(previous.attemptedDays)&&previous.attemptedDays<previous.batchDays){through=previous.through;days=previous.batchDays}
  else through=previous.nextThrough<through?previous.nextThrough:through
 }
 else if(previous.status==='partial'&&valid(previous.through)){
  const count=Number(previous.batchDays)||14,attempted=(Number(previous.completedDays)||0)+(previous.failedDates?.length||0)
  if(attempted>=count)through=shiftDay(previous.from||shiftDay(previous.through,1-count),-1)
  else {through=previous.through;days=count}
 }
 if(through<target)return null
 days=Math.min(14,Math.max(1,days),Math.round((Date.parse(through)-Date.parse(target))/86400000)+1)
 return {from:shiftDay(through,1-days),through,batchDays:days}
}
export function applyBackfillProgress(batch,progress,previous={}){
 const dates=Array.from({length:batch.batchDays},(_,i)=>shiftDay(batch.from,i)),gaps=new Set(backfillGaps(previous))
 let completedDays=0,attemptedDays=0
 for(const day of dates){
  const report=progress.completed?.[day]||progress.failures?.[day]
  if(!report)continue
  attemptedDays++
  if(historicalDayComplete(report)){completedDays++;gaps.delete(day)}else gaps.add(day)
 }
 const gapBacklog=[...gaps].sort(),nextThrough=attemptedDays===dates.length?shiftDay(batch.from,-1):batch.through
 return {...batch,status:completedDays===dates.length&&!gapBacklog.length?'complete':'partial',completedDays,attemptedDays,nextThrough,failedDates:gapBacklog,gapBacklog}
}
