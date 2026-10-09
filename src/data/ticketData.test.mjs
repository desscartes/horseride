import test from 'node:test'
import assert from 'node:assert/strict'
import { buildBudgetTicket } from './ticketData.js'
const races=Array.from({length:6},(_,index)=>({city:'Bursa',no:index+1,time:'15.30',horses:Array.from({length:5},(_,horse)=>({no:horse+1,name:`At ${index+1}-${horse+1}`,probability:20,marketShare:40-horse*8}))}))
const predictions=races.map(race=>({city:race.city,raceNo:race.no,picks:race.horses.slice(0,4).map(horse=>({horseName:horse.name})),surprise:{horseName:race.horses[4].name,reason:'Geçmiş mesafe ve pist kanıtıyla desteklenen sürpriz aday.'}}))
const key=coupon=>coupon.legs.map(leg=>leg.horses.map(horse=>horse.number).sort().join(',')).join('|')
test('three unique AI alternatives stay within each budget and keep all six legs',()=>{
  for(const budget of [20,100,12000]){
    const ticket=buildBudgetTicket(races,predictions,races[0],'6li-ganyan',budget)
    const coupons=ticket.coupons.filter(coupon=>coupon.source==='ai')
    assert.equal(coupons.length,3);assert.equal(new Set(coupons.map(key)).size,3)
    assert.ok(coupons.every(coupon=>coupon.cost<=budget&&coupon.legs.length===6))
    assert.ok(coupons.some(coupon=>coupon.legs.some(leg=>leg.horses.some(horse=>horse.isSurprise))))
  }
})
test('no surprise is invented and withdrawn surprise runners are never included',()=>{
  const absent=predictions.map(({surprise,...prediction})=>prediction)
  const ticket=buildBudgetTicket(races,absent,races[0],'6li-ganyan',20)
  assert.equal(ticket.coupons.length,3)
  assert.ok(ticket.coupons.every(coupon=>coupon.legs.every(leg=>leg.horses.every(horse=>!horse.isSurprise))))
  const current=races.map(race=>({...race,horses:race.horses.slice(0,4)}))
  const withdrawn=buildBudgetTicket(current,predictions,current[0],'6li-ganyan',20)
  assert.ok(withdrawn.coupons.every(coupon=>coupon.legs.every(leg=>leg.horses.every(horse=>horse.number!==5))))
})

test('cached surprise picks cannot retain stars after becoming AGF favorites',()=>{
 const current=races.map(race=>({...race,horses:race.horses.map(h=>({...h,marketShare:h.no===5?70:7.5}))}))
 const ticket=buildBudgetTicket(current,predictions,current[0],'6li-ganyan',100)
 assert.ok(ticket.coupons.every(c=>c.legs.every(l=>l.horses.every(h=>!h.isSurprise))))
})
