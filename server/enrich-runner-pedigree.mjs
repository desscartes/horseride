import {readFileSync} from 'node:fs'
import {racingCountry,foreignHorseIdentity} from './foreign-data.mjs'
import {validatedRegistryPedigree} from './pedigree-registry.mjs'
import {verifiedChartPedigree} from './chart-pedigree.mjs'
import {loadProgramMaternalRecords,verifiedProgramMaternalLine} from './program-maternal-lines.mjs'
export function enrichRunnerPedigree(races,date,{registry,charts,maternalRecords}={}){
 maternalRecords??=loadProgramMaternalRecords()
 if(charts===undefined){try{charts=JSON.parse(readFileSync('data/external/equibase-pedigree/records.json','utf8')).records||[]}catch{charts=[]}}
 const byName=new Map()
 for(const row of charts){const key=foreignHorseIdentity(row.name);if(!byName.has(key))byName.set(key,[]);byName.get(key).push(row)}
 return races.map(race=>({...race,horses:race.horses.map(horse=>{
  if(horse.damsire)return horse
  const pedigree=validatedRegistryPedigree(horse,registry)||(racingCountry(race.city)==='US'?verifiedChartPedigree(horse,byName.get(foreignHorseIdentity(horse.name))||[],date):null)||verifiedProgramMaternalLine(horse,race,date,maternalRecords)
  return pedigree?{...horse,damsire:pedigree.damsire,pedigreeSource:pedigree}:horse
 })}))
}
