import {readFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {jockeyIdentityV2,horseIdentityV2} from './racing-identity.mjs'
import {horseIdentity} from './data-quality.mjs'
import {racingCountry} from './foreign-data.mjs'
const known=v=>v&&!['BILINMIYOR','UNKNOWN','N A',''].includes(v)
const country=r=>racingCountry(r.city)||'TR'
const distance=v=>Number(String(v||'').match(/\d+/)?.[0])||0
const rowMemo=new WeakMap()
const rowIdentity=r=>{let value=rowMemo.get(r);if(!value){value={country:country(r),jockey:jockeyIdentityV2(r.jockey),horse:horseIdentityV2(r.horseName),track:horseIdentity(r.city),surface:horseIdentity(r.surface),distance:distance(r.distance),key:JSON.stringify([r.date,horseIdentity(r.city),r.raceNo,horseIdentityV2(r.horseName)])};rowMemo.set(r,value)}return value}
const summary=rows=>({starts:rows.length,wins:rows.filter(r=>r.finishPosition===1).length,topThree:rows.filter(r=>r.finishPosition<=3).length})
export function jockeyEvidence(race,horse,date,rows){
 const name=jockeyIdentityV2(horse.jockey);if(!known(name))return null
 const dateCache=new Map(),since=days=>{if(dateCache.has(days))return dateCache.get(days);const value=new Date(Date.parse(date+'T12:00:00Z')-days*86400000).toISOString().slice(0,10);dateCache.set(days,value);return value}
 const raceCountry=country(race),track=horseIdentity(race.city),horseKey=horseIdentityV2(horse.name)
 const past=[...new Map(rows.filter(r=>r.date<date&&r.date>=since(730)&&rowIdentity(r).country===raceCountry&&rowIdentity(r).jockey===name&&Number.isInteger(Number(r.finishPosition))&&Number(r.finishPosition)>0).map(r=>[rowIdentity(r).key,typeof r.finishPosition==='number'?r:{...r,finishPosition:Number(r.finishPosition)}])).values()]
 const recent=past.filter(r=>r.date>=since(90)),d=distance(race.distance),ground=horseIdentity(race.surface)
 return {source:'dated_verified_archive_results',through:since(1),windowDays:90,...summary(recent),recent30:summary(recent.filter(r=>r.date>=since(30))),sameTrack:summary(recent.filter(r=>rowIdentity(r).track===track)),sameSurface:summary(recent.filter(r=>ground&&rowIdentity(r).surface===ground)),sameDistance:summary(recent.filter(r=>d&&rowIdentity(r).distance&&Math.abs(rowIdentity(r).distance-d)<=200)),partnership:summary(past.filter(r=>rowIdentity(r).horse===horseKey)),scope:'Yalnız arşivde doğrulanmış yarışlar; tam kariyer kaydı değildir.'}
}
export const jockeyResearchFeatureNames=['jockeyObserved30Starts','jockeyObserved90Starts','jockeyObserved30Place','jockeyObserved90Win','jockeyObserved90Place','jockeyTrack90Starts','jockeyTrack90Win','jockeySurface90Starts','jockeySurface90Win','jockeyDistance90Starts','jockeyDistance90Win','jockeyPartnershipStarts','jockeyPartnershipPlace','missingJockeyObserved90']
export function jockeyResearchFeatures(e){const s=e||{},rate=(r,place=false)=>((r?.[place?'topThree':'wins']||0)+(place?3:1))/((r?.starts||0)+10);return [s.recent30?.starts||0,s.starts||0,rate(s.recent30,true),rate(s),rate(s,true),s.sameTrack?.starts||0,rate(s.sameTrack),s.sameSurface?.starts||0,rate(s.sameSurface),s.sameDistance?.starts||0,rate(s.sameDistance),s.partnership?.starts||0,rate(s.partnership,true),+!(s.starts>0)]}
export function jockeyComment(horse,date,rival){
 if(!known(jockeyIdentityV2(horse.jockey)))return ''
 const e=horse.jockeyPerformance,valid=e?.source==='dated_verified_archive_results'&&e.through<date
 if(!valid)return `${horse.jockey} biniyor; yarış öncesine ait doğrulanmış jokey istatistiği bu açıklamada bulunmuyor.`
 const lines=[`${horse.jockey}, ${e.through} tarihine kadar arşivde doğrulanan son 90 günlük ${e.starts} yarışta ${e.wins} galibiyet ve ${e.topThree} ilk üç sonucu elde etmiş.`]
 if(e.recent30?.starts)lines.push(`Son 30 günlük bölümde ${e.recent30.starts} startta ${e.recent30.wins} galibiyet var.`)
 if(e.partnership?.starts)lines.push(`Bu atla önceki iki yılda kayıtlı ${e.partnership.starts} birliktelikte ${e.partnership.wins} galibiyet, ${e.partnership.topThree} ilk üç sonucu bulunuyor.`)
 const other=rival?.jockeyPerformance
 if(other?.source===e.source&&other.through===e.through&&other.starts>0&&jockeyIdentityV2(rival.jockey)!==jockeyIdentityV2(horse.jockey))lines.push(`${rival.name} jokeyi ${rival.jockey} için aynı dönemde ${other.starts} start ve ${other.wins} galibiyet kayıtlı.`)
 const last=(horse.horsePerformance?.recentRuns||[]).filter(r=>r.date<date&&known(jockeyIdentityV2(r.jockey))).sort((a,b)=>b.date.localeCompare(a.date))[0]
 if(last&&jockeyIdentityV2(last.jockey)!==jockeyIdentityV2(horse.jockey))lines.push(`Son kayıtlı yarışındaki ${last.jockey} yerine bugün ${horse.jockey} biniyor; değişiklik tek başına iyileşme kanıtı değildir.`)
 if(e.starts<10)lines.push('Jokey için örnek az; bu sayılardan güçlü üstünlük çıkarılamaz.')
 if(e.archiveThrough&&e.archiveThrough<e.through)lines.push(`Bu özette kullanılan arşivin son sonuç günü ${e.archiveThrough}; daha sonraki sonuçlar kapsanmıyor.`)
 lines.push('Bu sayımlar tam kariyeri kapsamaz ve tek başına jokey kalitesini ölçmez.')
 return lines.join(' ')
}

export function applyJockeyEvidence(program,snapshot){
 if(snapshot?.date!==program?.date||!Array.isArray(snapshot?.records))return program
 const records=new Map(snapshot.records.map(r=>[JSON.stringify([r.city,Number(r.raceNo),horseIdentityV2(r.horseName),jockeyIdentityV2(r.jockey)]),r]))
 return {...program,races:program.races.map(r=>({...r,horses:r.horses.map(h=>{const entry=records.get(JSON.stringify([r.city,Number(r.no),horseIdentityV2(h.name),jockeyIdentityV2(h.jockey)]));return entry?.evidence?.through<program.date?{...h,jockeyPerformance:{...entry.evidence,archiveThrough:snapshot.archiveThrough}}:h})}))}
}
export async function programWithJockeyEvidence(program){try{return applyJockeyEvidence(program,JSON.parse(await readFile(fileURLToPath(new URL(`../data/maintenance/jockey-evidence-${program.date}.json`,import.meta.url)),'utf8')))}catch{return program}}
