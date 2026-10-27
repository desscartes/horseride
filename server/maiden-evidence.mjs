import {debutEvidence} from './debut-evidence.mjs'
import {raceClass} from './race-class.mjs'
import {workoutTime} from './environment-features.mjs'

// Observed prior starts are not a complete career unless the source says so.
export function maidenEvidence(race,horse,date){
 const klass=raceClass(race)
 if(!klass.family.startsWith('maiden'))return null
 const rows=horse.horsePerformance?.pastRuns||horse.horsePerformance?.recentRuns||[]
 const past=[...new Map(rows.filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&r.date<date&&Number(r.finishPosition)>0).map(r=>[JSON.stringify([r.date,r.city,r.raceNo]),r])).values()].sort((a,b)=>b.date.localeCompare(a.date))
 const recent=past.slice(0,3),wins=past.filter(r=>Number(r.finishPosition)===1).length
 const maiden=past.filter(r=>raceClass({city:r.city||race.city,type:r.className||r.type||''}).family.startsWith('maiden'))
 const nearMisses=maiden.filter(r=>Number(r.finishPosition)===2).length
 const improving=recent.length>=3&&Number(recent[0].finishPosition)<Number(recent[1].finishPosition)&&Number(recent[1].finishPosition)<Number(recent[2].finishPosition)
 const lines=[past.length?`Maiden değerlendirmesi: doğrulanmış geçmişte ${maiden.length} maiden startı ve bu koşularda ${nearMisses} ikincilik var.`:'Önceki yarış sonucu doğrulanmadığı için değerlendirme hazırlık, soy ve jokey bilgileri üzerinden yapılmalı; boş yarış geçmişi olumsuz form göstergesi değildir.']
 if(wins)lines.push('Geçmişte galibiyet kaydı bulundu; maiden uygunluğu ve at eşleştirmesi resmî koşu şartlarından kontrol edilmeli.')
 else if(nearMisses||improving)lines.push(`${improving?'Son üç kayıtlı yarışında bitiriş sırası iyileşmiş. ':''}${nearMisses?'Maiden ikincilikleri rekabet edebildiğini gösteriyor. ':''}Bu bulgular ilk galibiyet adayı olarak incelenmesini destekler; bugün kazanması gerektiği anlamına gelmez.`)
 else if(horse.australianEvidence?.career?.starts===0)lines.push('Resmî kayda göre ilk startına çıkıyor; geçmiş maiden sonucu olmaması veri toplama hatası veya olumsuz form değildir.')
 else if(past.length)lines.push('Mevcut sonuçlar ilk galibiyet için belirgin bir gelişim kanıtı sunmuyor; ilk kez koşan atlar yalnız sonuç geçmişiyle elenemez.')
 const target=Date.parse(`${date}T12:00:00Z`),norm=v=>String(v||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/ı/g,'i').trim()
 const workouts=(horse.workouts||[]).filter(w=>{const age=(target-Date.parse(`${w.dateISO}T12:00:00Z`))/86400000;return age>0&&age<=30})
 const seen=new Set(),timed=workouts.filter(w=>{
  const key=JSON.stringify([w.dateISO,w.hippodrome,w.splits]);if(seen.has(key))return false;seen.add(key)
  return w.surface&&race.surface&&norm(w.surface)===norm(race.surface)&&workoutTime(w.splits?.['400'],400)!=null
 }).sort((a,b)=>b.dateISO.localeCompare(a.dateISO))
 if(workouts.length)lines.push(`Son 30 günde ${workouts.length} kayıtlı idmanı var.`)
 if(timed.length>=3){
  const latest=workoutTime(timed[0].splits['400'],400),previous=timed.slice(1).filter(w=>w.hippodrome&&w.hippodrome===timed[0].hippodrome)
  if(previous.length>=2){const mean=previous.reduce((sum,w)=>sum+workoutTime(w.splits['400'],400),0)/previous.length
   lines.push(`Aynı idman hipodromu ve pist türündeki son 400 metre kaydı ${latest.toLocaleString('tr-TR')} saniye; önceki ${previous.length} kaydın ortalaması ${mean.toLocaleString('tr-TR',{maximumFractionDigits:1})} saniye. İdmanın çalışma şiddeti ve zemin koşulları doğrulanmadan bu fark form artışı sayılmaz.`)
  }
 }
 if(!workouts.length)lines.push(horse.trialEvidence?.some(t=>t.date<date)?'Resmî deneme koşuları ayrı kayıtlıdır; bunlar standart idman ara derecesiyle aynı ölçüm değildir.':'Yakın dönem idman kaydı eksik; bu eksiklik olumsuz idman yapıldığı anlamına gelmez.')
 return {debut:debutEvidence(horse,date),observedStarts:past.length,maidenStarts:maiden.length,maidenSeconds:nearMisses,improving,eligibilityConflict:wins>0,workoutRecords:workouts.length,text:lines.join(' ')}
}
