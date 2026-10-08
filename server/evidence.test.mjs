import test from 'node:test'
import assert from 'node:assert/strict'
import {officialChartLinks} from './collect-career-charts.mjs'
import {usableWeather,marketBenchmark} from './temporal-evidence.mjs'
import {matchedPace,chartDistance} from './pace-evidence.mjs'
import {prospectiveMetrics} from './prospective-metrics.mjs'
import {capturePrestart} from './capture-prestart.mjs'
import {mkdtemp,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {isProcessRunning} from './process-liveness.mjs'
test('official calendar dates, embedded JSON and unsafe/future filenames',()=>{
  const text='{"URL":"/static/chart/pdf/SA100626USA.html"} GP100726USA.pdf SA100626USA.pdf XX023126USA.pdf ../GP100626CAN.pdf'
  assert.deepEqual(officialChartLinks(text,'2026-10-06','2026-10-01').map(r=>r.name),['SA100626USA.pdf'])
})
test('weather must have been available before start; no reanalysis or later publication',()=>{
  const start='2026-10-06T12:30:00Z',snapshot={kind:'single_run_forecast',initializedAt:'2026-10-06T00:00:00Z',availableAt:'2026-10-06T08:00:00Z',hourly:{time:['2026-10-06T12:00'],temperature_2m:[null],precipitation:[0],wind_speed_10m:[12]}}
  assert.equal(usableWeather(snapshot,start).temperatureC,null)
  assert.equal(usableWeather({...snapshot,kind:'reanalysis'},start),null)
  assert.equal(usableWeather({...snapshot,availableAt:start},start),null)
  assert.equal(usableWeather({...snapshot,initializedAt:'2026-10-07T00:00:00Z'},start),null)
  assert.equal(usableWeather({...snapshot,availableAt:'bad'},start),null)
})
test('market benchmark rejects post-start, partial and tied markets',()=>{
  const race={horses:[{no:1,name:'A',marketShare:20},{no:2,name:'B',marketShare:80}]},at='2026-10-06T10:00:00Z',start='2026-10-06T11:00:00Z'
  assert.equal(marketBenchmark(race,at,start).picks[0].horseName,'B')
  assert.equal(marketBenchmark(race,start,start),null)
  assert.equal(marketBenchmark({horses:[race.horses[0],{name:'C'}]},at,start),null)
  assert.equal(marketBenchmark({horses:[{marketShare:50},{marketShare:50}]},at,start),null)
})
test('pace compares surface and distance; never uses target-day charts',()=>{
 const chart={date:'2026-10-05',conditions:'Distance: Six Furlongs On The Dirt',runners:[{name:'A',calls:{Start:2,'1/4':1,Str:2,Fin:2}},{name:'B',calls:{Fin:1}}]}
 assert.equal(chartDistance(chart.conditions),1207.008)
 assert.equal(matchedPace('A',{distance:1200,surface:'Kum'},'2026-10-06',[chart])[0],1)
 assert.equal(matchedPace('A',{distance:1200,surface:'Çim'},'2026-10-06',[chart])[0],0)
 assert.equal(matchedPace('A',{distance:2000,surface:'Kum'},'2026-10-06',[chart])[0],0)
 assert.equal(matchedPace('A',{distance:1200,surface:'Kum'},'2026-10-05',[chart])[0],0)
 assert.equal(matchedPace('A',{distance:1200,surface:'TAPETA'},'2026-10-06',[{...chart,conditions:'Distance: Six Furlongs On The All Weather Track'}])[0],1)
})
test('prospective evaluation reports coverage and market on the same settled races',()=>{
 const at='2026-10-06T09:00:00Z',start='2026-10-06T10:00:00Z',row={date:'2026-10-06',city:'Bursa',raceNo:1,capturedAt:at,scheduledStart:start,trainedThrough:'2026-10-04',modelVersion:'M',race:{horses:[{name:'A',probability:40},{name:'B',probability:60}]},market:{picks:[{horseName:'B'},{horseName:'A'}]}}
 const outcomes=new Map([['2026-10-06:Bursa:1',new Map([['A',1],['B',2]])]])
 const report=prospectiveMetrics([row,{...row,capturedAt:start}],outcomes,{frozenAt:'2026-10-05T00:00:00Z'})
 assert.equal(report.evaluated,1);assert.equal(report.allRaceTopOne,100);assert.equal(report.prestartMarketTopOne,0);assert.equal(report.suggestionCoverage,100)
 assert.equal(prospectiveMetrics([{...row,trainedThrough:row.date}],outcomes,{frozenAt:'2026-10-05T00:00:00Z'}).evaluated,0)
})
test('capture excludes started races and uses matched model metadata rather than mixed-program metadata',async()=>{
 const output=await mkdtemp(join(tmpdir(),'horseride-prestart-'))
 try{
   const horses=[{no:1,name:'A',marketShare:70,probability:60},{no:2,name:'B',marketShare:30,probability:40}]
   const races=[{city:'Bursa',no:1,time:'10.00',horses},{city:'Bursa',no:2,time:'12.00',rankingMethod:'TR-test',horses},{city:'Gulfstream Park ABD',no:1,time:'23.00',rankingMethod:'unknown',horses}]
   const result=await capturePrestart({output,now:()=>new Date('2026-10-07T08:00:00Z'),request:async url=>{assert.equal(url.pathname,'/api/races');return {ok:true,json:async()=>({races,modelTrainedThrough:'2026-10-06'})}},weatherProvider:async rows=>rows,metadataProvider:async r=>r.rankingMethod==='TR-test'?{trainedThrough:'2026-10-04',country:'TR'}:null})
   const data=JSON.parse(await readFile(result.file,'utf8'))
   assert.equal(result.records,2);assert.equal(data.records[0].trainedThrough,'2026-10-04');assert.equal(data.records[1].trainedThrough,null);assert.equal(data.paidAiRequested,false)
 }finally{await rm(output,{recursive:true,force:true})}
})
test('Windows EPERM does not permanently preserve a confirmed dead service lock',()=>{
 const denied=()=>{throw Object.assign(Error(),{code:'EPERM'})}
 assert.equal(isProcessRunning(123,{probe:denied,platform:'win32',windowsProbe:()=>false}),false)
 assert.equal(isProcessRunning(123,{probe:denied,platform:'win32',windowsProbe:()=>true}),true)
 assert.equal(isProcessRunning(123,{probe:denied,platform:'win32',windowsProbe:()=>{throw Error()}}),true)
 assert.equal(isProcessRunning(123,{probe:denied,platform:'linux'}),true)
 assert.equal(isProcessRunning(-1,{probe:()=>{throw Error('Unsafe pid')}}),true)
})
