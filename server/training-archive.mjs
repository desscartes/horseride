import {mergeWinnerTargets} from './winner-only-target.mjs'
import {readFileSync} from 'node:fs'
import {dirname,join} from 'node:path'
import {listHistoricalRaces,historicalRaceDates,iterateHistoricalDay} from './database.mjs'
const read=path=>JSON.parse(readFileSync(path,'utf8'))
let winnerTargets
function withWinnerTargets(rows,date){
 if(!process.env.AU_WINNER_ARCHIVE_PATH)return rows
 winnerTargets||=read(process.env.AU_WINNER_ARCHIVE_PATH).races
 return mergeWinnerTargets(rows,winnerTargets,date)
}
let prizeRegistry
function withPrizes(rows,date){
 if(!process.env.RACE_PRIZE_REGISTRY_PATH)return rows
 prizeRegistry||=read(process.env.RACE_PRIZE_REGISTRY_PATH).records
 return rows.map(r=>({...r,prizeMoney:r.prizeMoney||prizeRegistry[JSON.stringify([date,r.city,Number(r.no)])]||null}))
}
export function trainingArchiveDates(path=process.env.TRAINING_ARCHIVE_PATH){
 if(!path)return historicalRaceDates()
 const saved=read(path);return saved.format==='daily_v1'?saved.days:[...new Set(saved.map(r=>r.date))].sort()
}
export function trainingArchiveDay(date,path=process.env.TRAINING_ARCHIVE_PATH){
 if(!path)return withPrizes(withWinnerTargets([...iterateHistoricalDay(date)],date),date)
 const saved=read(path),rows=saved.format==='daily_v1'?read(join(dirname(path),'archive-days',`${date}.json`)):saved.filter(r=>r.date===date)
 return withPrizes(withWinnerTargets(rows.map(r=>({...r,results:new Map(r.results)})),date),date)
}
export function trainingArchive(path=process.env.TRAINING_ARCHIVE_PATH,{foreign}={}){
 if(!path)return listHistoricalRaces().filter(r=>foreign===undefined||Boolean(r.foreign)===foreign)
 return trainingArchiveDates(path).flatMap(day=>trainingArchiveDay(day,path).filter(r=>foreign===undefined||Boolean(r.foreign)===foreign))
}
