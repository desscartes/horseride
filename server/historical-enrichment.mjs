import {matchingEquibaseChart} from './foreign-data.mjs'
export function chartObservedEnvironment(race,charts){
 const chart=matchingEquibaseChart(race,charts)
 if(!chart||!chart.going)return null
 return {date:race.date,availability:'post_race_chart',provider:'Equibase',sourceUrl:chart.sourceUrl,temperatureC:chart.temperatureC??null,tracks:[{surface:race.surface,condition:chart.going}],weather:chart.weatherText||null}
}
