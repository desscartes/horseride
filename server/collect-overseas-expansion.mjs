import './runtime-env.mjs'
import {remoteDeployment} from './deployment-role.mjs'
import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {spawn} from 'node:child_process'
import {localDay,shiftDay} from './maintenance-policy.mjs'
import {collectCareerCharts} from './collect-career-charts.mjs'
import {collectEquibaseWorkouts} from './collect-equibase-workouts.mjs'
import {collectHongKongTrackwork} from './collect-hkjc-trackwork.mjs'
if(remoteDeployment())throw Error('Collection belongs to the home server')
const day=localDay(),through=shiftDay(day,-1),root=process.argv[2]
if(!root?.startsWith('data/overseas-expansion/'))throw Error('Use a versioned overseas-expansion output directory')
await mkdir(root,{recursive:true})
const config=JSON.parse(await readFile('data/maintenance/config.json','utf8'))
const state={day,through,startedAt:new Date().toISOString(),phase:'collecting',steps:[],errors:[]}
const save=()=>writeFile(`${root}/collection-state.json`,JSON.stringify(state,null,2))
const run=(args,env={})=>new Promise((ok,fail)=>{const p=spawn(process.execPath,args,{windowsHide:true,stdio:'inherit',env:{...process.env,HORSERIDE_NO_LISTEN:'1',...env}});p.on('error',fail);p.on('exit',code=>code===0?ok():fail(Error(`${args[0]} exited ${code}`)))})
const attempt=async(name,fn)=>{state.phase=name;await save();try{const result=await fn();state.steps.push({name,result,completedAt:new Date().toISOString()})}catch(e){state.errors.push({name,error:e.message})}await save()}
await attempt('older_foreign_results',()=>run(['--use-system-ca','server/collect-foreign-history.mjs','30','2025-10-04']))
await attempt('recent_foreign_results',()=>run(['--use-system-ca','server/collect-foreign-history.mjs','7',through]))
await attempt('recent_US_charts',()=>run(['--use-system-ca','server/collect-equibase-charts.mjs'],{ARCHIVE_THROUGH_DATE:through,ARCHIVE_FROM_DATE:shiftDay(through,-30)}))
await attempt('expanded_US_charts',()=>collectCareerCharts({output:'data/external/equibase-career',through,from:shiftDay(through,-180),existingDirectory:'data/external/equibase',maxDownloads:180}))
for(const directory of ['data/external/equibase','data/external/equibase-career'])await attempt(`parse_${directory}`,()=>new Promise((ok,fail)=>{const p=spawn(config.python,['server/parse-equibase-charts.py',directory],{windowsHide:true,stdio:'inherit'});p.on('error',fail);p.on('exit',c=>c===0?ok():fail(Error(`PDF parser exited ${c}`)))}))
await attempt('US_workouts',collectEquibaseWorkouts)
await attempt('HK_results',()=>run(['--use-system-ca','server/enrich-hkjc-history.mjs']))
await attempt('HK_trackwork',collectHongKongTrackwork)
// Retain observed official source pages. These are discovery evidence, not model features.
await attempt('official_source_access',async()=>{
 const sources=[['GB','https://www.britishhorseracing.com/racing/results/'],['FR','https://www.france-galop.com/fr/calendriers'],['AU','https://www.racingaustralia.horse/FreeFields/Calendar_Results.aspx?State=NSW'],['ZA','https://www.nhra.co.za/index.php/racing/stipes-reports']]
 const rows=[]
 for(const [country,url]of sources){try{const r=await fetch(url,{signal:AbortSignal.timeout(20000)}),html=await r.text();await writeFile(`${root}/${country}-official-source.html`,html);rows.push({country,url,status:r.status,bytes:html.length,integrated:false,observedAt:new Date().toISOString()})}catch(e){rows.push({country,url,error:e.message,integrated:false})}}
 await writeFile(`${root}/source-access.json`,JSON.stringify(rows,null,2));return rows
})
state.phase=state.errors.length?'partial':'complete';state.finishedAt=new Date().toISOString();await save();console.log(JSON.stringify(state))
