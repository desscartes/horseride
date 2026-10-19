import './runtime-env.mjs'
import {readFileSync,writeFileSync} from 'node:fs'
import {iterateHistoricalDay} from './database.mjs'
import {racingCountry} from './foreign-data.mjs'
import {localDay,shiftDay} from './maintenance-policy.mjs'
const through=shiftDay(localDay(),-1),registry=JSON.parse(readFileSync('data/external/race-prizes/records.json','utf8')).records
const dates=[...new Set(Object.keys(registry).map(key=>JSON.parse(key)[0]).filter(date=>date<=through))].sort()
const countries={},matched=new Set()
for(const date of dates)for(const race of iterateHistoricalDay(date)){
 const key=JSON.stringify([date,race.city,Number(race.no)]),record=registry[key]
 if(!record)continue
 const country=racingCountry(race.city)||'TR',entry=countries[country]||={races:0,first:date,last:date,currencies:{}}
 entry.races++;entry.last=date;matched.add(key)
 const currency=record.prizes.find(p=>p.position===1)?.currency||'unknown';entry.currencies[currency]=(entry.currencies[currency]||0)+1
}
const eligible=Object.keys(registry).filter(key=>JSON.parse(key)[0]<=through)
const unmatched=eligible.filter(key=>!matched.has(key))
const report={checkedAt:new Date().toISOString(),through,registryRaces:Object.keys(registry).length,eligibleRegistryRaces:eligible.length,matchedHistoricalRaces:matched.size,countries,unmatched,unmatchedSample:unmatched.slice(0,10)}
writeFileSync('data/maintenance/prize-coverage.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report))
