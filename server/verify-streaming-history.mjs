import {readFile,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
import {streamingRankingHistories} from './streaming-ranking-history.mjs'
import {createRankingHistory,addRankingDayToHistory} from './ranking.mjs'
import {racingCountry} from './foreign-data.mjs'
const [root,out]=process.argv.slice(2)
if(!root?.startsWith('data/intelligence-models/')||!out?.startsWith('data/experiments/'))throw Error('Versioned paths required')
const archive=JSON.parse(await readFile(root+'/archive.json','utf8')),dates=archive.days.filter(d=>d>='2026-09-01'&&d<'2026-10-05').sort(),daily=new Map()
for(const date of dates)daily.set(date,JSON.parse(await readFile(`${root}/archive-days/${date}.json`,'utf8')).map(r=>({...r,results:new Map(r.results)})))
const groups=new Map(),expected=new Map();let races=0
for(const date of dates)for(const race of daily.get(date)){const country=race.foreign?racingCountry(race.city):'TR';if(!country)continue;races++;const key=`${date}:${country}`;if(!groups.has(key))groups.set(key,{country,date,races:[]});groups.get(key).races.push(race)}
for(const [,g]of [...groups].sort(([a],[b])=>a.localeCompare(b)))for(const identityVersion of [1,2]){const key=identityVersion===2?`${g.country}:v2`:g.country;if(!expected.has(key))expected.set(key,createRankingHistory({identityVersion}));addRankingDayToHistory(expected.get(key),g.races,g.date)}
const actual=streamingRankingHistories({dates,targetDate:'2026-10-05',readDay:date=>daily.get(date),versionsForCountry:()=>new Set([1,2])});assert.deepEqual(actual,expected)
const report={checkedAt:new Date().toISOString(),from:dates[0],through:dates.at(-1),days:dates.length,races,countryIdentityHistories:actual.size,legacyHistoryStateIdentical:true,scope:'Frozen real month, both identity versions, all recognized countries. This verifies refactor semantics, not model predictive improvement.'}
await writeFile(out+'/streaming-history-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report))
