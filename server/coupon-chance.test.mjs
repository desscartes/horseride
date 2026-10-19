import test from 'node:test'
import assert from 'node:assert/strict'
import {couponChanceText} from '../src/data/couponChance.js'
test('tiny positive estimate is not rounded to a misleading zero',()=>{
 assert.match(couponChanceText(0.000001),/%0,01’den az/)
 assert.match(couponChanceText(0.0017),/%0,17/)
 assert.match(couponChanceText(0),/%0 ·/)
 assert.match(couponChanceText(1),/%100 ·/)
 assert.match(couponChanceText(0.2),/Kalibre edilmemiş/)
})
test('missing or invalid estimates do not appear as zero or certainty',()=>{
 for(const value of [null,undefined,'0.5',NaN,Infinity,-0.2,1.01])assert.equal(couponChanceText(value),'Tutma tahmini hesaplanamadı')
})
