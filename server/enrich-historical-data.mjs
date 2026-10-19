import './runtime-env.mjs'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {historicalRaceDates,iterateHistoricalDay,saveHistoricalRace,latestNumericForecastDecisions} from './database.mjs'
import {loadArchivedForecasts,archivedWeatherForDecision,prestartWeatherKey} from './prestart-weather-history.mjs'
import {mergeOfficialCharts} from './overseas-chart-input.mjs'
import {chartObservedEnvironment} from './historical-enrichment.mjs'
import {horseEquipment} from './horse-equipment.mjs'
import {validatedRegistryPedigree} from './pedigree-registry.mjs'
import {verifiedChartPedigree} from './chart-pedigree.mjs'
import {foreignHorseIdentity} from './foreign-data.mjs'
import {racingCountry} from './foreign-data.mjs'
import {remoteDeployment} from './deployment-role.mjs'
import {localDay,shiftDay} from './maintenance-policy.mjs'
if(remoteDeployment())throw Error('Historical enrichment belongs to the home server')
const through=process.env.ARCHIVE_THROUGH_DATE||shiftDay(localDay(),-1)
const sources=await Promise.all(['data/external/equibase/parsed.json','data/external/equibase-career/parsed.json'].map(async p=>{try{return JSON.parse(await readFile(p,'utf8'))}catch{return {races:[]}}}))
const charts=mergeOfficialCharts(sources,through).races,index=new Map()
const pedigreeIndex=new Map();let pedigrees=[];try{pedigrees=JSON.parse(await readFile('data/external/equibase-pedigree/records.json','utf8')).records||[]}catch{}
for(const row of pedigrees){const key=foreignHorseIdentity(row.name);if(!pedigreeIndex.has(key))pedigreeIndex.set(key,[]);pedigreeIndex.get(key).push(row)}
for(const c of charts){if(!index.has(c.date))index.set(c.date,[]);index.get(c.date).push(c)}
const report={startedAt:new Date().toISOString(),through,races:0,updated:0,equipmentEntries:0,matchedOfficialConditions:0,addedDamsire:0,countries:{}}
const forecasts=await loadArchivedForecasts()
const decisions=new Map((forecasts.from?latestNumericForecastDecisions(shiftDay(forecasts.from,-2),through):[]).map(row=>[prestartWeatherKey(row.date,row.city,row.raceNo),row]))
Object.assign(report,{forecastFiles:forecasts.files,invalidForecastFiles:forecasts.invalidFiles,matchedPrestartForecasts:0,addedPrestartForecasts:0})
// Finish each day's read cursor before taking a write lock. A live API may
// commit while a WAL read snapshot is open, making snapshot upgrade impossible.
for(const date of historicalRaceDates().filter(d=>d<=through))for(const race of [...iterateHistoricalDay(date)]){
 report.races++;let changed=false
 for(const h of race.horses){const equipment=horseEquipment(h);if(equipment){report.equipmentEntries++;if(h.equipment!==equipment){h.equipment=equipment;changed=true}}const pedigree=validatedRegistryPedigree(h)||(racingCountry(race.city)==='US'?verifiedChartPedigree(h,pedigreeIndex.get(foreignHorseIdentity(h.name))||[],date):null);if(pedigree&&!h.damsire){h.damsire=pedigree.damsire;h.pedigreeSource=pedigree;report.addedDamsire++;changed=true}}
 const observed=chartObservedEnvironment(race,index.get(date)||[])
 if(observed){report.matchedOfficialConditions++;if(JSON.stringify(race.historicalObservedEnvironment)!==JSON.stringify(observed)){race.historicalObservedEnvironment=observed;changed=true}}
 const forecast=archivedWeatherForDecision(race,decisions.get(prestartWeatherKey(date,race.city,race.no)),forecasts.byCity.get(race.city)||[])
 if(forecast){report.matchedPrestartForecasts++;if(JSON.stringify(race.archivedPrestartWeather)!==JSON.stringify(forecast)){race.archivedPrestartWeather=forecast;report.addedPrestartForecasts++;changed=true}}
 if(changed){saveHistoricalRace(date,race,race.results);report.updated++;const c=racingCountry(race.city)||'TR';report.countries[c]=(report.countries[c]||0)+1}
}
report.finishedAt=new Date().toISOString();await mkdir('data/maintenance/enrichment',{recursive:true});await writeFile('data/maintenance/enrichment/latest.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report))
