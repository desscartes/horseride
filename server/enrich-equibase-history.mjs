import {readFile,writeFile} from 'node:fs/promises'
import {listHistoricalRaces,saveHistoricalRace} from './database.mjs'
import {matchingEquibaseChart,foreignHorseIdentity} from './foreign-data.mjs'
const charts=JSON.parse(await readFile('data/external/equibase/parsed.json','utf8')).races
const report={charts:charts.length,matchedRaces:0,matchedRunners:0,unmatchedCharts:charts.length}
for(const race of listHistoricalRaces().filter(r=>r.foreign)){
  const chart=matchingEquibaseChart(race,charts)
  if(!chart)continue
  const evidence={provider:'Equibase',sourceUrl:chart.sourceUrl,availability:'post_race',date:chart.date,going:chart.going,temperatureC:chart.temperatureC,fractionalTimes:chart.fractionalTimes,winnerTime:chart.winnerTime}
  const enriched={...race,externalEvidence:evidence,horses:race.horses.map(h=>({...h,externalEvidence:{...evidence,...chart.runners.find(r=>foreignHorseIdentity(r.name)===foreignHorseIdentity(h.name))}}))}
  saveHistoricalRace(race.date,enriched,race.results);report.matchedRaces++;report.matchedRunners+=race.horses.length
}
report.unmatchedCharts-=report.matchedRaces;await writeFile('data/external/equibase/matching-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report))
