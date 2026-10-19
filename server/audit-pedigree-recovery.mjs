import {readFile,writeFile} from 'node:fs/promises'
import {validatedRegistryPedigree} from './pedigree-registry.mjs'
const root=process.argv[2]||'data/intelligence-models/2026-10-17/morning',read=async p=>JSON.parse(await readFile(p,'utf8'))
const data=await read(`${root}/TR/TR-training.json`),metadata=await read(`${root}/TR/report.json`),registry=(await read('data/external/tjk-pedigree/registry.json')).records,index=data.featureNames.indexOf('missingDamsire')
if(index<0)throw Error('Frozen schema has no missingDamsire field')
const groups=new Map()
for(const race of data.races.filter(r=>r.date>=metadata.train.from&&r.date<=metadata.train.through)){if(!groups.has(race.date))groups.set(race.date,[]);groups.get(race.date).push(race)}
const report={checkedAt:new Date().toISOString(),root,scope:'TR frozen fit period',races:0,runners:0,knownInFrozenInput:0,additionalVerifiedNow:0,unmatchedFrozenRows:0,uniqueRecoveredHorses:0,note:'Source availability audit only. Frozen features and trained models are unchanged. Extra records become available on a future export; this is not a measured accuracy gain.'},horses=new Set()
for(const [date,races]of groups){
 const archive=await read(`${root}/archive-days/${date}.json`),byRace=new Map(archive.map(r=>[JSON.stringify([r.city,Number(r.no)]),r]))
 for(const race of races){report.races++;const old=byRace.get(JSON.stringify([race.city,Number(race.no)])),byName=new Map((old?.horses||[]).map(h=>[h.name,h]))
  for(let i=0;i<race.features.length;i++){report.runners++;if(race.features[i][index]===0){report.knownInFrozenInput++;continue}const h=byName.get(race.horses[i]);if(!h){report.unmatchedFrozenRows++;continue}if(validatedRegistryPedigree(h,registry)){report.additionalVerifiedNow++;horses.add(String(h.horseId||h.sourceData?.tjk?.horseId))}}
 }
}
report.uniqueRecoveredHorses=horses.size;report.frozenCoveragePercent=Number((100*report.knownInFrozenInput/report.runners).toFixed(2));report.availableAfterNewExportPercent=Number((100*(report.knownInFrozenInput+report.additionalVerifiedNow)/report.runners).toFixed(2))
await writeFile('data/maintenance/pedigree-recovery-audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report))
