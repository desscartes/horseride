import {readFileSync,readdirSync} from 'node:fs'
import assert from 'node:assert/strict'
import {evaluateTreeModel,createRankingHistory,addRankingDayToHistory,raceFeatures,rankRaceLocally} from './ranking.mjs'
import {performanceFeatures} from './performance-features.mjs'
import {paceHistory,paceFeatures} from './pace-features.mjs'
import {externalChartHistory,externalChartFeatures,equibaseTracks,racingCountry} from './foreign-data.mjs'
import {horseIdentityV2} from './racing-identity.mjs'
import {summarizeWorkoutHistory} from './workout-history.mjs'
import {matchEquibaseWorkouts} from './equibase-workouts.mjs'
import {listHistoricalRaces} from './database.mjs'
const root=process.env.FOREIGN_MODEL_DIR||'data/foreign-models-next',read=path=>JSON.parse(readFileSync(path,'utf8'))
const archive=listHistoricalRaces(),charts=read('data/external/equibase/parsed.json').races,external=externalChartHistory(charts),paces=paceHistory(charts)
const tablesByHorse=new Map(),uniqueRows=new Map()
for(const file of readdirSync('data/training-workouts').filter(f=>/^\d{4}-\d{2}-\d{2}\.json$/.test(f))){const page=read(`data/training-workouts/${file}`);if(page.complete)for(const table of page.tables)for(const row of table.rows)uniqueRows.set(JSON.stringify(row),{headers:table.headers,rows:[row]})}
for(const table of uniqueRows.values()){const key=horseIdentityV2(table.rows[0][table.headers.indexOf('At Adı')]);if(!tablesByHorse.has(key))tablesByHorse.set(key,[]);tablesByHorse.get(key).push(table)}
const workouts=read('data/external/equibase-workouts/records.json').records
for(const country of ['TR','US']){
 const metadata=read(`${root}/${country}-report.json`),ref=read(`${root}/${country}-reference.json`),model=read(`${root}/${country}-test.json`)
 const differences=ref.features.map((f,i)=>Math.abs(evaluateTreeModel(model,metadata.featureIndexes.map(j=>f[j]))-ref.scores[i]))
 assert.ok(Math.max(...differences)<1e-9)
 const data=read(`${root}/${country}-training.json`),target=data.races.find(r=>r.date>=metadata.test.from),history=createRankingHistory({identityVersion:metadata.identityVersion||1}),days=new Map()
 for(const r of archive.filter(r=>(racingCountry(r.city)||'TR')===country&&r.date<target.date)){if(!days.has(r.date))days.set(r.date,[]);days.get(r.date).push(r)}
 for(const [date,rows] of [...days].sort(([a],[b])=>a.localeCompare(b)))addRankingDayToHistory(history,rows,date)
 const race=archive.find(r=>r.date===target.date&&r.city===target.city&&r.no===target.no)
 race.horses=race.horses.map(h=>({...h,workouts:country==='TR'?summarizeWorkoutHistory(tablesByHorse.get(horseIdentityV2(h.name))||[],h.name,target.date,{identityVersion:2}):matchEquibaseWorkouts(workouts,h,target.date)}))
 const base=raceFeatures(race,target.date,history),extra=performanceFeatures(race,target.date,history.performance),pace=country==='US'?paceFeatures(race,target.date,paces,equibaseTracks[race.city]?.name):null
 const vectors=base.map((f,i)=>[...f,...(country==='US'?externalChartFeatures(race.horses[i],target.date,country,external):[]),...extra[i],...(pace?pace[i]:[])])
 for(const [i,name] of target.horses.entries())assert.deepEqual(vectors[race.horses.findIndex(h=>h.name===name)],target.features[i])
 const bundle={metadata:{...metadata,trainedThrough:metadata.validation.through,country:country==='TR'?undefined:country},model,externalHistory:external,paceHistory:paces}
 const ranked=rankRaceLocally(race,target.date,history,bundle)
 assert.equal(ranked.rankingMethod,metadata.method)
 const expected=target.horses[ref.scores.indexOf(Math.max(...ref.scores))]
 assert.equal(ranked.horses[0].name,expected)
 console.log(JSON.stringify({country,date:target.date,features:target.features[0].length,pythonNodeMaxDifference:Math.max(...differences),fullLiveTrainingFeatureParity:true,rankingWinnerParity:true}))
}
