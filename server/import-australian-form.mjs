import {readFileSync,writeFileSync,mkdirSync,renameSync} from 'node:fs'
import {parseAustralianForm} from './australian-form.mjs'
const [date,city,file,url]=process.argv.slice(2)
const snapshot=parseAustralianForm(readFileSync(file,'utf8'),{date,city,sourceUrl:url})
const path='data/external/racing-australia/registry.json';mkdirSync('data/external/racing-australia',{recursive:true})
let registry={snapshots:[]};try{registry=JSON.parse(readFileSync(path,'utf8'))}catch{}
registry.snapshots=registry.snapshots.filter(s=>s.date!==date||s.city!==city);registry.snapshots.push(snapshot)
writeFileSync(path+'.tmp',JSON.stringify(registry));renameSync(path+'.tmp',path)
console.log(JSON.stringify({date,city,profiles:snapshot.runners.length,careerKnown:snapshot.runners.filter(p=>p.career).length,previousRuns:snapshot.runners.reduce((n,p)=>n+p.pastRuns.length,0),trials:snapshot.runners.reduce((n,p)=>n+p.trials.length,0)}))