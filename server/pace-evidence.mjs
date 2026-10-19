export const paceEvidenceNames=['matchedPaceStarts','matchedEarlyLead','matchedEarlyPosition','matchedLateGain','matchedStretchGain','matchedDaysSinceRun','missingMatchedPace']
const mean=a=>a.length?a.reduce((n,v)=>n+v,0)/a.length:0
export function chartDistance(conditions=''){
  const text=conditions.match(/Distance:\s*([^\n]+?)\s+On The /i)?.[1]?.toLowerCase().trim()
  const furlongs={'five furlongs':5,'five and one half furlongs':5.5,'six furlongs':6,'six and one half furlongs':6.5,'seven furlongs':7,'seven and one half furlongs':7.5,'one mile':8,'one mile and seventy yards':8+70/220,'one and one sixteenth miles':8.5,'one and one eighth miles':9,'one and one quarter miles':10}
  return text&&furlongs[text]?furlongs[text]*201.168:null
}
const surface=value=>/turf|çim|cim/i.test(value)?'turf':/synthetic|sentetik|all weather|tapeta|polytrack/i.test(value)?'synthetic':/dirt|kum/i.test(value)?'dirt':null
export function matchedPace(runnerName,race,date,charts){
  const distance=Number(String(race.distance||'').match(/\d+/)?.[0]),ground=surface(race.surface)
  const rows=[]
  for(const chart of charts){
    const meters=chartDistance(chart.conditions),chartGround=surface(chart.conditions?.match(/On The ([^\n]+)/)?.[1])
    if(chart.date>=date||!ground||chartGround!==ground||meters==null||!distance||Math.abs(meters-distance)>200)continue
    // Caller supplies an exact official chart name; do not merge country suffixes here.
    const matches=chart.runners.filter(r=>r.name===runnerName);if(matches.length!==1)continue
    const runner=matches[0],n=chart.runners.length,early=Object.entries(runner.calls||{}).find(([key])=>!['Start','Str','Fin'].includes(key))?.[1],finish=runner.calls?.Fin
    if(n<2||!Number.isInteger(early)||!Number.isInteger(finish)||early<1||finish<1||early>n||finish>n)continue
    rows.push({date:chart.date,early,finish,stretch:runner.calls.Str,n})
  }
  const selected=rows.toSorted((a,b)=>b.date.localeCompare(a.date)).slice(0,8),stretch=selected.filter(r=>Number.isInteger(r.stretch)&&r.stretch>=1&&r.stretch<=r.n)
  return [selected.length,mean(selected.map(r=>+(r.early===1))),mean(selected.map(r=>(r.n-r.early)/(r.n-1))),mean(selected.map(r=>(r.early-r.finish)/(r.n-1))),mean(stretch.map(r=>(r.stretch-r.finish)/(r.n-1))),selected.length?(Date.parse(date)-Date.parse(selected[0].date))/86400000:999,+!selected.length]
}
