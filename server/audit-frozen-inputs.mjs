import {readFileSync} from 'node:fs'
import {join} from 'node:path'
const root=process.argv[2]
if(!root?.startsWith('data/intelligence-models/'))throw Error('Expected versioned training directory')
const read=path=>JSON.parse(readFileSync(path,'utf8'))
process.env.PEDIGREE_REGISTRY_PATH=join(root,'pedigree-registry.json')
const {horsePedigree}=await import('./pedigree-features.mjs'),{racingCountry}=await import('./foreign-data.mjs')
const countries={}
for(const date of read(join(root,'archive.json')).days)for(const race of read(join(root,'archive-days',date+'.json'))){
 const country=racingCountry(race.city)||'TR';if(!['TR','US','GB','FR','ZA'].includes(country))continue
 const row=countries[country]||={races:0,runners:0,withSire:0,withDam:0,withDamsire:0,withRegistryId:0,withArchivedEnvironment:0,withPostraceEnvironment:0,withStoredPrizes:0}
 const environment=race.environment||race.horses.map(h=>h.sourceData?.tjk?.raceEnvironment).find(e=>e?.date===date)
 row.races++;if(environment?.date===date)row.withArchivedEnvironment++
 if(race.historicalObservedEnvironment?.date===date)row.withPostraceEnvironment++
 if(race.prizeMoney?.prizes?.length)row.withStoredPrizes++
 for(const horse of race.horses){const family=horsePedigree(horse);row.runners++;row.withSire+=+!!family.sire;row.withDam+=+!!family.dam;row.withDamsire+=+!!family.damsire;row.withRegistryId+=+!!(horse.horseId||horse.sourceData?.tjk?.horseId)}
}
console.log(JSON.stringify({scope:'frozen_archive_fields_not_final_joined_training_coverage',countries}))
