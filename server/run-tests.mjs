import {readdir} from 'node:fs/promises'
import {spawn} from 'node:child_process'
const files=[]
async function collect(root){for(const e of await readdir(root,{withFileTypes:true})){const p=root+'/'+e.name;if(e.isDirectory())await collect(p);else if(e.name.endsWith('.test.mjs'))files.push(p)}}
await collect('server');await collect('src')
const child=spawn(process.execPath,['--import','./server/test-env.mjs','--test','--test-concurrency=2','--test-timeout=60000',...files.sort()],{stdio:'inherit',windowsHide:true})
child.once('error',e=>{console.error(e.message);process.exitCode=1});child.once('exit',code=>{process.exitCode=code??1})
