import './runtime-env.mjs'
import {mkdir,writeFile} from 'node:fs/promises'
import {applicationTickets,applicationOutcomes} from './database.mjs'
import {summarizeApplication,reportStart} from './application-report.mjs'
import {localDay} from './maintenance-policy.mjs'
import {racingCountry} from './foreign-data.mjs'
const today=localDay(),tickets=applicationTickets(reportStart).filter(t=>Number.isFinite(t.estimatedChance)&&t.legCount===6)
const summary=summarizeApplication({snapshots:[],outcomes:applicationOutcomes(reportStart),tickets,today,period:'total'})
const describe=rows=>{const weakest=rows.map(t=>t.legs.map(l=>l.estimatedCoverage)).filter(v=>v.length===6&&v.every(Number.isFinite)).map(v=>Math.min(...v));const settled=rows.filter(t=>t.status!=='pending'),won=settled.filter(t=>t.status==='won');return {recorded:rows.length,settled:settled.length,won:won.length,observedRate:settled.length?won.length/settled.length:null,meanModelCoverage:settled.length?settled.reduce((n,t)=>n+t.estimatedChance,0)/settled.length:null,modelExpectedHits:settled.reduce((n,t)=>n+t.estimatedChance,0),pending:rows.length-settled.length,weakestLegKnown:weakest.length,weakestLegMean:weakest.length?weakest.reduce((n,v)=>n+v,0)/weakest.length:null,spent:settled.reduce((n,t)=>n+t.cost,0)}}
const rows=summary.coupons,group=fn=>Object.fromEntries([...new Set(rows.map(fn))].map(k=>[k,describe(rows.filter(t=>fn(t)===k))]))
const report={checkedAt:new Date().toISOString(),from:reportStart,through:today,total:describe(rows),byCountry:group(t=>racingCountry(t.city)||'TR'),byBudget:group(t=>String(t.budget)),bySource:group(t=>t.source||'numeric_daily'),bins:[[0,.01],[.01,.05],[.05,.1],[.1,.25],[.25,1.000001]].map(([lo,hi])=>({from:lo,to:hi,...describe(rows.filter(t=>t.estimatedChance>=lo&&t.estimatedChance<hi))})),note:'Descriptive audit of immutable pre-start six-leg tickets, deduplicated by actual selections and stake across sources with official settlement only. Selected and overlapping tickets are correlated; these counts are not independent trials and do not establish calibration. Pending results are excluded from observed success. No model or threshold is fitted to these outcomes.'}
await mkdir('data/maintenance',{recursive:true});await writeFile(`data/maintenance/coupon-quality-${today}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report))
