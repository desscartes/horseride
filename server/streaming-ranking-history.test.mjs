import test from 'node:test'
import assert from 'node:assert/strict'
import {streamingRankingHistories} from './streaming-ranking-history.mjs'
import {createRankingHistory,addRankingDayToHistory} from './ranking.mjs'
import {racingCountry} from './foreign-data.mjs'
const race=(date,city,no)=>({date,city,no,foreign:city.endsWith('ABD'),distance:'1200',surface:'Kum',type:'Maiden',conditions:'3 Yaşlı İngilizler',horses:[{no:1,name:'A KG',jockey:'J AP',trainer:'T',weight:55},{no:2,name:'B',jockey:'K',trainer:'U',weight:56}],results:new Map([[1,{finishPosition:1,timeSeconds:72}],[2,{finishPosition:2,timeSeconds:73}]])})
test('day streaming equals legacy grouped histories for countries and both identities',()=>{
 const rows=[race('2026-01-01','Ankara',1),race('2026-01-01','Ankara',2),race('2026-01-01','Finger Lakes ABD',1),race('2026-01-02','Ankara',1),race('2026-01-02','Finger Lakes ABD',1),race('2026-01-03','Ankara',1)],groups=new Map(),expected=new Map()
 for(const r of rows.filter(r=>r.date<'2026-01-03')){const c=r.foreign?racingCountry(r.city):'TR',key=`${r.date}:${c}`;if(!groups.has(key))groups.set(key,{date:r.date,country:c,races:[]});groups.get(key).races.push(r)}
 for(const [,g]of [...groups].sort(([a],[b])=>a.localeCompare(b)))for(const v of [1,2]){const k=v===2?g.country+':v2':g.country;if(!expected.has(k))expected.set(k,createRankingHistory({identityVersion:v}));addRankingDayToHistory(expected.get(k),g.races,g.date)}
 const visited=[],actual=streamingRankingHistories({dates:['2026-01-03','2026-01-02','2026-01-01'],targetDate:'2026-01-03',readDay:day=>{visited.push(day);return rows.filter(r=>r.date===day)},versionsForCountry:()=>new Set([1,2])})
 assert.deepEqual(actual,expected);assert.deepEqual(visited,['2026-01-01','2026-01-02'])
})
