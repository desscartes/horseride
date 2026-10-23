import {workoutTime} from './environment-features.mjs'
import {jockeyComment} from './jockey-evidence.mjs'
import {surpriseCandidates} from '../src/data/surprisePolicy.js'
import {parseWeight} from './data-quality.mjs'
import {maidenEvidence} from './maiden-evidence.mjs'
import {recentLoadEvidence} from './recent-load-evidence.mjs'
import {racingCountry} from './foreign-data.mjs'
const num=v=>{if(v==null||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null}
const positive=v=>num(v)>0
const tr=n=>Number(n).toLocaleString('tr-TR',{maximumFractionDigits:1})
const surface=v=>String(v||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/ı/g,'i').trim()
const uniqueRuns=rows=>[...new Map(rows.map(r=>[JSON.stringify([r.date,r.city||null,r.raceNo||null]),r])).values()]
export function profileEvidenceRace(race,date){
 const distance=v=>Number(String(v||'').match(/\d+/)?.[0])||0
 const since=new Date(Date.parse(`${date}T12:00:00Z`)-730*86400000).toISOString().slice(0,10)
 const summarize=rows=>({starts:rows.length,wins:rows.filter(r=>r.finishPosition===1).length,topThree:rows.filter(r=>r.finishPosition<=3).length,averageFinish:rows.length?Math.round(rows.reduce((n,r)=>n+r.finishPosition,0)/rows.length*10)/10:null})
 return {...race,horses:race.horses.map(h=>{
  const p=h.horsePerformance||{},rows=uniqueRuns(p.pastRuns||[]).filter(r=>r.date>=since&&r.date<date&&positive(r.finishPosition)).map(r=>({...r,finishPosition:Number(r.finishPosition)})).sort((a,b)=>b.date.localeCompare(a.date))
  const sameSurface=rows.filter(r=>surface(r.surface)===surface(race.surface)),sameDistance=rows.filter(r=>distance(r.distance)>0&&Math.abs(distance(r.distance)-distance(race.distance))<=200)
  return {...h,horsePerformance:{...p,recentRuns:p.recentRuns||rows,sameSurface:p.sameSurface||summarize(sameSurface),sameDistance:p.sameDistance||summarize(sameDistance),sameDistanceAndSurface:p.sameDistanceAndSurface||summarize(sameDistance.filter(r=>surface(r.surface)===surface(race.surface)))}}
 })}
}
export function recentEvidenceRuns(horse,date){
 return uniqueRuns(horse.horsePerformance?.recentRuns||horse.horsePerformance?.pastRuns||[]).filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&(!date||r.date<date)&&positive(r.finishPosition)).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3)
}
export function detailedHorseChoices(race,horse,date){
 const runs=recentEvidenceRuns(horse,date),last=runs[0],stats=horse.horsePerformance||{},same=stats.sameDistanceAndSurface,pist=stats.sameSurface
 const au=horse.australianEvidence, trials=(horse.trialEvidence||[]).filter(r=>r.date<date).sort((a,b)=>b.date.localeCompare(a.date));
 const debut=au?.career?.starts===0;
 const trialText=trials.length?(' Resmî deneme kayıtlarında '+trials.length+' çalışma var; sonuncusu '+trials[0].date+' tarihinde '+trials[0].distance+' metrede '+trials[0].finishPosition+'/'+trials[0].fieldSize+' bitiriş. Deneme derecesi yarış kazanma garantisi değildir.') : '';
 const recent=debut?('Racing Australia resmî kaydına göre ilk yarış startına çıkıyor.'+trialText):runs.length?`Son ${runs.length} kayıtlı yarışındaki bitirişleri, yeniden eskiye ${runs.map(r=>r.finishPosition).join(' / ')}.`:'Yarış öncesi doğrulanmış yakın dönem sonuçları sınırlı.'
 const latest=last?`${last.date} tarihli${last.city?' '+last.city:''} yarışında${last.distance?' '+last.distance+' metre':''}${last.surface?' '+last.surface+' pistte':''}${last.className?' '+last.className+' sınıfında':''} ${last.finishPosition}. oldu.`:''
 const records=(s,label)=>positive(s?.starts)?`${label} ${s.starts} koşu${num(s.wins)!=null?'da '+s.wins+' galibiyet':' kaydı'}${num(s.topThree)!=null?', '+s.topThree+' ilk üç derecesi':''}${positive(s.averageFinish)?'; ortalama bitiriş '+tr(s.averageFinish):''}.`:null
 const fit=[records(same,`${race.surface||'Aynı'} pistte ve bugünkü mesafeye ±200 metre aralıkta`),records(pist,`Tüm mesafelerde ${race.surface||'aynı'} pistte`)].filter(Boolean)
 if(!fit.length)fit.push('Bu pist ve yakın mesafe için doğrulanmış karşılaştırma kaydı yok; uyum üstünlüğü çıkarılamıyor.')
 if(num(same?.wins)>0)fit.push('Bu galibiyetler pist ve mesafe uyumunu destekliyor; bugünkü rakiplerin gücünü tek başına açıklamaz.')
 else if(num(same?.starts)>=3&&num(same?.wins)===0)fit.push('Bu örneklerde galibiyeti bulunmadığı için pist/mesafe üstünlüğü varsayılmıyor.')
 const detail=[];const maiden=maidenEvidence(race,horse,date);if(maiden)detail.push(maiden.text)
 const weight=parseWeight(horse.weight),oldWeight=last?parseWeight(last.weight):null
 if(weight!=null&&oldWeight!=null){const delta=weight-oldWeight;detail.push(delta===0?`Bugün ${tr(weight)} kilo ile son yarışındaki kiloyu taşıyor.`:`Bugün ${tr(weight)} kilo taşıyor; son kayıtlı yarışına göre ${tr(Math.abs(delta))} kilo ${delta<0?'daha hafif':'daha ağır'}.`)}
 else if(weight!=null)detail.push(`Bugünkü kilosu ${tr(weight)}; önceki yarışla kilo karşılaştırması doğrulanamıyor.`)
 if(horse.jockey&&last?.jockey)detail.push(horse.jockey===last.jockey?`${horse.jockey} ile devam ediyor.`:`Son yarıştaki ${last.jockey} yerine ${horse.jockey} biniyor.`)
 if(last?.className&&race.type)detail.push(`Son koşusunun sınıfı ${last.className}; bugünkü yarış ${race.type}.`)
 const risk=positive(same?.starts)&&same.starts<3?`Pist/mesafe karşılaştırması yalnız ${same.starts} koşuya dayanıyor; örnek az.`:runs.length&&runs[0].finishPosition>3?`Son yarışında ilk üçe giremedi; güncel rakipler karşısında toparlanması gerekiyor.`:'Geçmiş dereceler bugünkü rakipler karşısında aynı sonucu garanti etmez.'
 return {form:[[recent,latest].filter(Boolean).join(' ')],uyum:[fit.join(' ')],risk:[[...detail,risk].join(' ')]}
}
export function evidenceSurprise(race,picks,date,{allowedNames}={}){
 const leaders=new Set(picks.slice(0,2).map(p=>typeof p==='string'?p:p.horseName))
 const allowed=new Set(allowedNames||surpriseCandidates(race,picks)),candidates=[]
 for(const horse of race.horses){
  if(horse.outOfRace||leaders.has(horse.name)||!allowed.has(horse.name))continue
  const p=horse.horsePerformance||{},same=p.sameDistanceAndSurface,pist=p.sameSurface,runs=recentEvidenceRuns(horse,date),proof=[]
  if(num(same?.starts)>=2&&num(same?.wins)>=1)proof.push(`Aynı pistte ve yakın mesafedeki ${same.starts} koşuda ${same.wins} galibiyeti var.`)
  else if(num(same?.starts)>=3&&num(same?.topThree)>=2)proof.push(`Aynı pistte ve yakın mesafedeki ${same.starts} koşunun ${same.topThree} tanesinde ilk üçe girdi.`)
  if(num(pist?.starts)>=3&&num(pist?.wins)>=1&&runs.some(r=>r.finishPosition<=3))proof.push(`${race.surface} pistte ${pist.starts} koşuda ${pist.wins} galibiyet; son ${runs.length} yarışında ${runs.filter(r=>r.finishPosition<=3).length} ilk üç derecesi bulunuyor.`)
  if(runs.length>=2&&runs.slice(0,2).every(r=>r.finishPosition<=3)&&runs.slice(0,2).some(r=>surface(r.surface)===surface(race.surface)))proof.push(`Son iki kayıtlı yarışını ${runs[0].finishPosition}. ve ${runs[1].finishPosition}. bitirdi; bu yarışlardan en az biri bugünkü pist yüzeyinde.`)
  if(!proof.length)continue
  candidates.push({horse,proof,score:proof.length*10+(num(same?.wins)||0)+(num(same?.topThree)||0),order:race.horses.indexOf(horse)})
 }
 candidates.sort((a,b)=>b.score-a.score||a.order-b.order)
 const best=candidates[0];if(!best)return null
 return {horseName:best.horse.name,reason:`${num(best.horse.marketShare)!=null?'Değerlendirme anındaki AGF payı %'+tr(best.horse.marketShare)+'; AGF':'AGF'} ve aday sıralamasında ilk ikinin dışında. ${best.proof.slice(0,2).join(' ')} Bu somut kayıtlar sürpriz aday olarak incelenmesini destekliyor; favorilere göre belirsizliği daha yüksek.`}
}
export function baselineSelectionReason(race,horse,rival){
 if(race.rankingSource!=='program_baseline')return null
 if(horse.australianEvidence?.career?.starts===0||(!String(horse.lastSix||'').match(/[1-9]/)&&!(horse.horsePerformance?.recentRuns?.length)&&!positive(horse.horsePerformance?.sameDistanceAndSurface?.starts)))return null
 const digits=h=>(String(h.lastSix||'').match(/[0-9]/g)||[]).slice(-6)
 const form=h=>{const ds=digits(h);return ds.length?ds.reduce((s,v)=>s+(v==='0'?0.15:Math.max(.1,1-(Number(v)-1)*.16)),0)/ds.length:.5}
 const weights=race.horses.map(h=>parseWeight(h.weight)).filter(v=>v>0),min=Math.min(...weights)
 const weight=h=>{const w=parseWeight(h.weight);return w>0&&Number.isFinite(min)?Math.max(.2,1-(w-min)/15):.5}
 const lines=[],ds=digits(horse),w=parseWeight(horse.weight),rw=rival&&parseWeight(rival.weight)
 if(ds.length)lines.push(`Programdaki son ${ds.length} sonuç hanesinde ${ds.filter(v=>v==='1').length} galibiyet ve ${ds.filter(v=>Number(v)>0&&Number(v)<=3).length} ilk üç sonucu var (kayıt: ${horse.lastSix}).`)
 if(rival){
  const rd=digits(rival),changes=[]
  if(ds.length&&rd.length){const delta=(form(horse)-form(rival))*.42*100;changes.push(`sonuç dizisi ${delta>=0?'+':''}${tr(delta)} puan`)}
  if(w>0&&rw>0){const delta=(weight(horse)-weight(rival))*.16*100;changes.push(`kilo bileşeni ${delta>=0?'+':''}${tr(delta)} puan`);lines.push(`${tr(w)} kilo taşıyor; ${rival.name} ${tr(rw)} kilo ile koşuyor${w!==rw?`, aralarında ${tr(Math.abs(w-rw))} kilo fark var`:''}.`)}
  if(changes.length)lines.push(`Mevcut program puanlamasında ${rival.name} ile karşılaştırıldığında ${changes.join(', ')} fark oluşturuyor (100 puan ölçeğinde).`)
  if(positive(horse.start)&&positive(rival.start))lines.push(`Start yeri ${horse.start}, ${rival.name} için ${rival.start}; bu bilgi tek başına pistte avantaj kanıtı değildir.`)
 }
 if(!lines.length)return null
 lines.push('Bu sıralama sonuç dizisi ve program bilgilerini puanlıyor; yarışların sınıfı, rakip gücü ve koşu içi şartları doğrulanmadan performans üstünlüğü ya da kazanma olasılığı olarak yorumlanamaz.')
 return lines.join(' ')
}
export function preparationHorseReason(race,horse,date,rival){
 const verified=horse.australianEvidence?.career?.starts===0,lines=[verified?'Resmî kariyer kaydına göre ilk startına çıkıyor; değerlendirme yarış sonucu yerine hazırlık verilerine dayanıyor.':'Bu açıklamada doğrulanmış önceki yarış sonucu bulunmuyor; bu durum tek başına ilk start olduğunu göstermez. Hazırlık ve program bilgileri üzerinden değerlendiriliyor.']
 const formDigits=(String(horse.lastSix||'').match(/[0-9]/g)||[]).slice(-6);if(formDigits.length)lines.push(`Programdaki son ${formDigits.length} sonuç hanesinde ${formDigits.filter(x=>x==='1').length} galibiyet, ${formDigits.filter(x=>Number(x)>0&&Number(x)<=3).length} ilk üç sonucu var (kayıt: ${horse.lastSix}); yarışların tarih ve sınıf ayrıntıları bu özette doğrulanamıyor.`)
 const target=Date.parse(date+'T12:00:00Z'),rows=[...new Map((horse.workouts||[]).filter(w=>{const day=w.dateISO||w.date;return /^\d{4}-\d{2}-\d{2}$/.test(day)&&day<date&&target-Date.parse(day+'T12:00:00Z')<=30*86400000}).map(w=>[JSON.stringify([w.dateISO||w.date,w.hippodrome,w.splits]),w])).values()].sort((a,b)=>(b.dateISO||b.date).localeCompare(a.dateISO||a.date))
 if(rows.length){const last=rows[0],splits=[400,800,1000].map(d=>{const value=workoutTime(last.splits?.[String(d)],d);return value!=null?`${d} metre ${tr(value)} saniye`:null}).filter(Boolean);lines.push(`Son 30 günde ${rows.length} kayıtlı idmanı var. En son ${last.dateISO||last.date}${last.hippodrome?' '+last.hippodrome:''}${last.surface?' '+last.surface+' pistte':''} çalışmış${splits.length?'; kayıtlı ara dereceler: '+splits.join(', '):''}.`);lines.push('İdman şiddeti ve zemin aynı şekilde ölçülmediği için bu dereceler tek başına rakiplerinden daha hazır olduğunu kanıtlamaz.')}
 else lines.push('Doğrulanmış son 30 günlük idman ayrıntısı bu açıklamada yok; hazırlığı hakkında olumlu veya olumsuz hüküm verilemiyor.')
 const trials=(horse.trialEvidence||[]).filter(t=>t.date<date&&Number(t.finishPosition)>0).sort((a,b)=>b.date.localeCompare(a.date))
 if(trials.length){const t=trials[0];lines.push(`Son resmî denemesi ${t.date}${Number(t.distance)>0?' '+t.distance+' metre':''}: ${t.finishPosition}. bitiriş${Number(t.fieldSize)>0?' / '+t.fieldSize+' at':''}. Deneme sonucu yarış performansıyla aynı ölçüm değildir.`)}
 if(horse.sire||horse.dam)lines.push(`Soy bilgisi:${horse.sire?' baba '+horse.sire:''}${horse.dam?', anne '+horse.dam:''}. Yalnız ebeveyn adına bakarak pist veya mesafe üstünlüğü çıkarılmıyor.`)
 const weight=parseWeight(horse.weight);if(weight>0)lines.push(`Bugün ${tr(weight)} kilo${positive(horse.start)?', '+horse.start+'. start yerinden':''} koşacak.`)
 const jockey=jockeyComment(horse,date,rival);if(jockey)lines.push(jockey)
 lines.push('İlk sıralarda bulunması, henüz ölçülmüş bir yarış üstünlüğü değildir; ilk start öncesi güveni hazırlık kanıtının kapsamıyla sınırlı tutulur.')
 return lines.join(' ')
}
export function fluentHorseReason(race,horse,date,rival){
 if(horse.australianEvidence?.career?.starts===0||(!recentEvidenceRuns(horse,date).length&&!positive(horse.horsePerformance?.sameDistanceAndSurface?.starts)&&!String(horse.lastSix||'').match(/[1-9]/)))return preparationHorseReason(race,horse,date,rival)
 const baseline=baselineSelectionReason(race,horse,rival);if(baseline)return [baseline,jockeyComment(horse,date,rival)].filter(Boolean).join(' ')
 const runs=recentEvidenceRuns(horse,date),last=runs[0],same=horse.horsePerformance?.sameDistanceAndSurface,load=recentLoadEvidence(runs,horse.workouts||[],horse,race,date),lines=[]
 const maiden=maidenEvidence(race,horse,date)
 if(horse.australianEvidence?.career?.starts===0)return preparationHorseReason(race,horse,date,rival)
 if(last)lines.push(`Son kayıtlı yarışında ${last.distance?last.distance+' metre ':''}${last.surface?last.surface+' pistte ':''}${last.finishPosition}. olması${last.finishPosition<=3?' yakın dönem formunu destekliyor':' nedeniyle güncel formunu yeniden göstermesi gerekiyor'}.`)
 if(positive(same?.starts))lines.push(`Bugünkü pistte ve yakın mesafelerdeki ${same.starts} kayıtlı koşuda ${num(same.wins)||0} galibiyet${num(same.topThree)!=null?' ve '+same.topThree+' ilk üç derecesi':''} bulunuyor${same.starts<3?'; bu karşılaştırma henüz dar bir örneğe dayanıyor':''}.`)
 const other=rival?.horsePerformance?.sameDistanceAndSurface
 if(num(same?.starts)>=3&&num(other?.starts)>=3)lines.push(`${rival.name} aynı koşullardaki ${other.starts} kayıtlı yarışın ${num(other.wins)||0} tanesini kazanmış; farklı rakiplere karşı alınan bu sonuçlar tek başına üstünlük kanıtı sayılmaz.`)
 const delta=load.carriedWeightChangeKg
 if(delta!=null&&delta!==0)lines.push(`Son yarışına göre ${tr(Math.abs(delta))} kilo ${delta<0?'daha hafif':'daha ağır'} koşacak${delta>0?'; kilo artışı değerlendirmede dikkat gerektiriyor':''}.`)
 else if(load.daysSinceLastObservedStart!=null)lines.push(`Son doğrulanmış yarışından bu yana ${load.daysSinceLastObservedStart} gün geçti${load.distanceChangeMeters?'; bugün '+tr(Math.abs(load.distanceChangeMeters))+' metre '+(load.distanceChangeMeters>0?'daha uzun':'daha kısa')+' mesafeye çıkıyor':''}.`)
 if(maiden)lines.push(maiden.text)
 if(!last&&!positive(same?.starts))return preparationHorseReason(race,horse,date,rival)
 else if(lines.length<3)lines.push('Bu kayıtlar bugünkü rakiplerin tamamına karşı nasıl koşacağını tek başına belirlemiyor.')
 return [...lines,jockeyComment(horse,date,rival)].filter(Boolean).join(' ')
}
export function commentaryModelCaution(race,prediction){
 const country=racingCountry(race.city)
 if(!country||race.rankingSource==='local_trained_model')return {}
 const label=({AU:'Avustralya',MY:'Malezya',CA:'Kanada',GB:'Birleşik Krallık',FR:'Fransa',ZA:'Güney Afrika',US:'ABD'})[country]||country
 return {confidence:'low',risks:[...new Set([...(prediction.risks||[]),`${label} için doğrulanmış etkin model yok; sıralama program puanlamasına dayanıyor.`])]}
}
export function enrichCommentaryRace(race,prediction,date){
 const picks=prediction.picks.map(p=>{const horse=race.horses.find(h=>h.name===p.horseName);if(!horse)return p;const rival=prediction.picks.map(p=>race.horses.find(h=>h.name===p.horseName)).find(h=>h&&!h.outOfRace&&h.name!==horse.name);return {...p,reason:fluentHorseReason(race,horse,date,rival)}})
 const allowed=Array.isArray(race.surpriseCandidates)?race.surpriseCandidates:surpriseCandidates(race,picks)
 const surprise=evidenceSurprise(race,picks,date,{allowedNames:allowed}),hasAgf=race.surpriseAgfAvailable??(race.horses.every(h=>typeof h.marketShare==='number'&&h.marketShare>=0)&&race.horses.some(h=>h.marketShare>0))
 const reason=surprise?'AGF favorileri dışındaki aday, doğrulanmış yarış kayıtlarıyla destekleniyor.':!hasAgf?'AGF verisi eksik olduğu için favori dışı sürpriz etiketi doğrulanamıyor.':`${allowed.length} favori dışı aday incelendi; mevcut pist/mesafe ve yakın dönem form kayıtları sürpriz seçimi için yeterli olumlu kanıt sunmuyor.`
 return {...prediction,...commentaryModelCaution(race,prediction),picks,surprise,surpriseAssessment:{status:surprise?'supported':!hasAgf?'missing_agf':'insufficient_evidence',reason},explanationRevision:'evidence-v3-fluent'}
}
