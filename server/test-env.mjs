import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
const root=mkdtempSync(join(tmpdir(),'horseride-test-'))
process.env.HORSERIDE_DB=join(root,'isolated.sqlite')
process.env.HORSERIDE_NO_LISTEN='1'
process.once('exit',()=>{try{rmSync(root,{recursive:true,force:true})}catch{}})
