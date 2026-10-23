import {readFile,writeFile} from 'node:fs/promises'
import {readServedProgram} from './served-program.mjs'
import {loadRankingModel,loadForeignRankingModel} from './ranking.mjs'
import {racingCountry} from './foreign-data.mjs'
import {workoutEvidence} from './workout-evidence.mjs'
import {localDay} from './maintenance-policy.mjs'
const date=process.argv[2]||localDay(),program=readServedProgram(date);if(!program?.races?.length)throw Error('No current program')
const countries={},rows=[],models=new Map()
for(const race of program.races){const c=racingCountry(race.city)||'TR';if(!models.has(c))models.set(c,c==='TR'?loadRankingModel():loadForeignRankingModel(c));const bundle=models.get(c),features=(bundle?.metadata.featureNames||[]).filter(n=>/workout/i.test(n)),splitFeatures=(bundle?.model.features_info.float_features||[]).filter(f=>/workout/i.test(f.feature_id)&&f.borders.length).map(f=>f.feature_id),used=race.rankingSource==='local_trained_model'&&splitFeatures.some(n=>!/^missing/i.test(n))
 if(!countries[c])countries[c]={runners:0,withPrior90:0,withPrior30:0,withTimedEvidence:0,ambiguous:0,activeWorkoutNumericsUsed:used,method:bundle?.metadata.method||null,selectedWorkoutFeatures:features,usedWorkoutSplitFeatures:splitFeatures}
 for(const h of race.horses.filter(h=>!h.outOfRace)){const e=workoutEvidence(h,date),timed=e.rows.some(w=>w.timed||Object.keys(w.validSplits).length);countries[c].runners++;countries[c].withPrior90+=+!!e.rows.length;countries[c].withPrior30+=+(e.count30>0);countries[c].withTimedEvidence+=+timed;countries[c].ambiguous+=+e.ambiguousIdentity;rows.push({city:race.city,raceNo:race.no,horseNo:h.no,name:h.name,prior90:e.rows.length,prior30:e.count30,prior14:e.count14,latest:e.rows[0]?.dateISO||null,timed,ambiguous:e.ambiguousIdentity,modelNumericsUsed:used})}}
let gaps=null;try{gaps=JSON.parse(await readFile('data/maintenance/current-workouts.json','utf8'))}catch{}
const report={date,checkedAt:new Date().toISOString(),programFetchedAt:program.fetchedAt,countries,rows,latestCollection:gaps,scope:'Available prior records and active model split usage separately. No completeness or causal accuracy claim; no training/model/forecast writes.'};await writeFile(`data/maintenance/workout-usage-${date}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({date,countries}))
