// A downloaded day is complete only when every discovered race was accepted.
export function historicalDayComplete(report){
 if(!report||!Array.isArray(report.reports)||!Array.isArray(report.failures)||report.failures.length)return false
 if(!Number.isInteger(report.meetings)||report.meetings!==report.reports.length)return false
 return report.reports.every(meeting=>!meeting.error&&Array.isArray(meeting.rejected)&&meeting.rejected.length===0&&Number.isInteger(meeting.expected)&&meeting.expected>0&&meeting.saved===meeting.expected)
}
export function reopenIncompleteDays(progress){
 progress.completed??={};progress.failures??={}
 for(const [date,report]of Object.entries(progress.completed))if(!historicalDayComplete(report)){
  progress.failures[date]=report;delete progress.completed[date]
 }
 return progress
}
