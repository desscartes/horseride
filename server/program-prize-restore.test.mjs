import test from 'node:test'
import assert from 'node:assert/strict'
import {restoreProgramPrizes} from './race-prizes.mjs'
test('SQLite program round trip restores prizes only for the same complete field',()=>{
 const stored={city:'İstanbul',no:1,distance:'1200m',surface:'Çim',horses:[{no:1,name:'A'},{no:2,name:'B'}]}
 const source={...stored,prizeMoney:{prizes:[{position:1,amount:100,currency:'TRY'}]}}
 assert.deepEqual(restoreProgramPrizes([stored],[source])[0].prizeMoney,source.prizeMoney)
 for(const wrong of [{...source,city:'Ankara'},{...source,distance:'1600m'},{...source,surface:'Kum'},{...source,horses:[{no:1,name:'OTHER'},{no:2,name:'B'}]}])assert.equal(restoreProgramPrizes([stored],[wrong])[0].prizeMoney,undefined)
 assert.equal(restoreProgramPrizes([stored],[source,source])[0].prizeMoney,undefined)
 assert.equal(stored.prizeMoney,undefined)
})
