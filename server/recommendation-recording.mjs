import {createHash} from 'node:crypto'
import {buildBudgetTicket} from '../src/data/ticketData.js'
import {recommendationSignature} from '../src/data/recommendationSignature.js'
import {analysisEntryFingerprint} from './analysis-entry-policy.mjs'
import {scheduledRaceStart} from './database.mjs'
import {racingCountry} from './foreign-data.mjs'
import {localDay,shiftDay} from './maintenance-policy.mjs'
export function verifiedRecommendationTickets(body,program,record,{now=new Date().toISOString()}={}){
 const {date,city,marketId,selections}=body,startRaceNo=Number(body.startRaceNo),budget=Number(body.budget),legCount=marketId==='6li-ganyan'?6:marketId==='5li-ganyan'?5:0
 const day=localDay(new Date(now))
 if(![shiftDay(day,-1),day,shiftDay(day,1)].includes(date)||program?.date&&program.date!==date||!legCount||!Number.isInteger(startRaceNo)||!Number.isInteger(budget)||budget<20||budget>12000||budget%10||typeof selections!=='string'||selections.length>4096)return []
 const races=(program?.races||[]).filter(r=>r.city===city),start=races.find(r=>Number(r.no)===startRaceNo),ordinal=start?.[legCount===6?'sixLegStarts':'fiveLegStarts']?.[0]
 if(!ordinal||!record?.analysis?.races||record.date!==date||record.city!==city)return []
 if(record.analysis.entryFingerprint&&record.analysis.entryFingerprint!==analysisEntryFingerprint(races))return []
 const scheduledStart=scheduledRaceStart(start.scheduledDate||date,start.time,{calendarDate:Boolean(start.scheduledDate)})
 if(!scheduledStart||now>=scheduledStart||record.createdAt>=scheduledStart)return []
 const ticket=buildBudgetTicket(races,record.analysis.races,start,marketId,budget)
 if(!ticket.available||recommendationSignature(ticket.coupons)!==selections)return []
 return ticket.coupons.filter(c=>c.source==='ai').map(c=>({date,city,country:racingCountry(city)||'TR',ordinal,legCount,startRaceNo,scheduledStart,capturedAt:now,budget,unitPrice:ticket.unitPrice,combinations:c.combinations,multiples:1,cost:c.cost,estimatedChance:c.estimatedCoveragePercent/100,calibrated:false,officialVerified:true,legs:c.legs,source:'ai_budget',sourceLabel:c.sourceLabel,algorithm:`ai-recorded-v1-${legCount}-${budget}-${createHash('sha256').update(JSON.stringify(c.legs.map(l=>[l.raceNo,l.horses.map(h=>h.number)]))).digest('hex').slice(0,20)}`}))
}
