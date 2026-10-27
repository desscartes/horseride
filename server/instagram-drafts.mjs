// Local content preparation only. No network requests, credentials or publishing.
import {createHash} from 'node:crypto'
export const instagramPlan={mode:'draft_only',timezone:'Europe/Istanbul',couponBudgetTL:50,maxCouponPostsPerDay:1,minimumMinutesBeforeStart:30,maxProgramAgeMinutes:15,publishEnabled:false}
export function introductionDraft(){return {kind:'introduction',status:'draft',title:'Ganyan Zekası',slides:[{title:'Veriye dayalı yarış analizi',body:'At, jokey, idman ve pist bilgilerini birlikte inceliyoruz.'},{title:'Neden bu at?',body:'Seçimlerimizi somut verilerle açıklıyor, belirsizlikleri görünür tutuyoruz.'},{title:'Sonuçları birlikte takip edeceğiz',body:'Kazanan ve kaybeden tüm yayımlanmış kuponları maliyetleriyle raporlayacağız.'}],caption:'Ganyan Zekası geliştirme aşamasında. Yarış öncesi analizlerimizi ve sonuçlarını burada paylaşacağız. Modelin başarısını ölçmeye devam ediyoruz; kazanç veya tutma garantisi vermiyoruz. 18+ | Bilgilendirme amaçlı analiz.'}}
export function couponDraft(ticket,{now,programFetchedAt,evidenceComplete=false}={}){
 const time=Date.parse(now),source=Date.parse(programFetchedAt),start=Date.parse(ticket?.scheduledStart)
 const fail=reason=>({status:'blocked',reason})
 if(!Number.isFinite(time)||!Number.isFinite(source)||source>time||time-source>instagramPlan.maxProgramAgeMinutes*60000)return fail('program_not_fresh')
 if(!Number.isFinite(start)||start-time<instagramPlan.minimumMinutesBeforeStart*60000)return fail('too_late')
 if(!evidenceComplete)return fail('evidence_not_verified')
 if(ticket.budget!==instagramPlan.couponBudgetTL||!(ticket.cost>0&&ticket.cost<=ticket.budget)||ticket.officialVerified!==true||ticket.legs?.length!==6)return fail('invalid_ticket')
 if(new Set(ticket.legs.map(l=>l.raceNo)).size!==6||ticket.legs.some(l=>!l.horses?.length||l.horses.some(h=>!h.name||!Number.isInteger(h.number))))return fail('invalid_legs')
 const selection=ticket.legs.map(l=>`${l.raceNo}. koşu: ${l.horses.map(h=>h.number+' '+h.name).join(', ')}`).join('\n')
 const caption=`${ticket.date} · ${ticket.city} · ${ticket.ordinal}. altılı\n${selection}\n\nModelin seçimi; gerçekleşmiş başarı oranı veya kazanç garantisi değildir. 18+`
 const key=[ticket.date,ticket.city,ticket.ordinal,ticket.budget].join('|')
 return {status:'draft',kind:'coupon',day:ticket.date,selectionKey:key,id:createHash('sha256').update(key+'|'+selection).digest('hex').slice(0,20),expiresAt:new Date(start-instagramPlan.minimumMinutesBeforeStart*60000).toISOString(),caption,publicationAllowed:false,requires:'Account authorization, image rendering, current entry revalidation and publication deduplication'}
}
