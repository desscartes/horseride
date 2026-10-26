import {readServedProgram} from './served-program.mjs'
import {couponBenchmarkPairs} from './coupon-benchmarks.mjs'
import {localDay} from './maintenance-policy.mjs'
import {mkdir,writeFile} from 'node:fs/promises'
const capturedAt=new Date().toISOString(),day=localDay(),pairs=couponBenchmarkPairs(readServedProgram(day),{now:capturedAt}),directory='data/external/coupon-benchmarks/'+day
await mkdir(directory,{recursive:true});await writeFile(directory+'/'+capturedAt.replace(/[:.]/g,'-')+'.json',JSON.stringify({capturedAt,day,pairs,historyReconstructed:false}),{flag:'wx'});console.log(JSON.stringify({capturedAt,pairs:pairs.length,historyReconstructed:false}))
