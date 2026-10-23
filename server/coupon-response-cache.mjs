import {createHash} from 'node:crypto'
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
export const couponCity=city=>['Tümü','Tüm program',''].includes(city)?'':city
export const couponInputSignature=(program,city='')=>createHash('sha256').update(JSON.stringify({date:program?.date,races:(program?.races||[]).filter(r=>!couponCity(city)||r.city===city).map(r=>({city:r.city,no:r.no,time:r.time,scheduledDate:r.scheduledDate,distance:r.distance,surface:r.surface,officialMarketsVerified:r.officialMarketsVerified,sixLegStarts:r.sixLegStarts,fiveLegStarts:r.fiveLegStarts,rankingSource:r.rankingSource,rankingMethod:r.rankingMethod,horses:r.horses.map(h=>({no:h.no,name:h.name,jockey:h.jockey,weight:h.weight,start:h.start,outOfRace:!!h.outOfRace,probability:h.probability}))}))})).digest('hex')
const directory=fileURLToPath(new URL('../data/maintenance/coupon-ready/',import.meta.url))
const pathFor=(date,city,dir)=>`${dir}/${date}/${createHash('sha256').update(couponCity(city)).digest('hex')}.json`
export async function saveCouponResponse(program,date,city,value,{dir=directory,now=new Date()}={}){if(program?.date!==date)throw Error('Coupon date mismatch');const path=pathFor(date,city,dir);await mkdir(`${dir}/${date}`,{recursive:true});const temp=path+'.'+process.pid+'.tmp';await writeFile(temp,JSON.stringify({date,city:couponCity(city),createdAt:now.toISOString(),signature:couponInputSignature(program,city),value}));await rename(temp,path)}
export async function readCouponResponse(program,date,city,{dir=directory,now=new Date()}={}){
 if(program?.date!==date)return null
 try{const saved=JSON.parse(await readFile(pathFor(date,city,dir),'utf8')),age=+now-Date.parse(saved.createdAt);if(saved.date!==date||saved.city!==couponCity(city)||age<0||age>15*60000||saved.signature!==couponInputSignature(program,city))return null
 const value=structuredClone(saved.value),future=t=>!t?.scheduledStart||Date.parse(t.scheduledStart)>+now
 for(const key of ['ticket','fiveTicket','surpriseTicket','socialTicket'])if(value[key]&&!future(value[key]))value[key]=null
 if(value.selectedMeetingCoupons)value.selectedMeetingCoupons=value.selectedMeetingCoupons.map(r=>r.ticket&&!future(r.ticket)?{...r,ticket:null,reason:'Bu altılı başladı; yeni oyun önerisi oluşturulmaz.'}:r)
 return {...value,cached:true,preparedAt:saved.createdAt}
 }catch{return null}
}
