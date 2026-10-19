import {readFileSync} from 'node:fs'
import {findDailyAiAnalysis,saveDailyAiAnalysis} from './database.mjs'
const staged=JSON.parse(readFileSync('data/maintenance/australian-commentary-update.json','utf8'))
const current=findDailyAiAnalysis(staged.date,staged.city)
if(current.inputHash!==staged.inputHash||current.createdAt!==staged.createdAt)throw Error('Analysis changed after staging; refresh evidence before applying')
saveDailyAiAnalysis(staged)
console.log(JSON.stringify({updated:true,races:staged.analysis.races.length,history:staged.analysis.races[0].evidence.withHistory}))