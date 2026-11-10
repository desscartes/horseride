import{buildRaceCardFacts,cleanHorseName}from'./race-card-facts.mjs';
import{buildForeignFormFacts}from'./foreign-form-facts.mjs';
import{racingCountry}from'../foreign-data.mjs';
import{loadRankingModel,loadForeignRankingModel}from'../ranking.mjs';
import{raceStart}from'./daily-scope-plan.mjs';
import{analysisEntryFingerprint}from'../analysis-entry-policy.mjs';
const key=v=>String(v).replace(/ı/g,'i').replace(/İ/g,'I').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function collectScopeViews(program,now=new Date().toISOString()){
 const clock=Date.parse(now),future={...program,publicationScope:'remaining',races:(program.races||[]).filter(r=>raceStart(r,program.date)>clock+10*60000)},views=[];
 for(const meeting of program.meetings||[]){
  const city=meeting.city,races=future.races.filter(r=>r.city===city);if(!races.length)continue;
  const country=meeting.foreign?racingCountry(city):'TR',entryFingerprint=analysisEntryFingerprint(races);
  const sourceUrl=(program.providerUrls||[]).find(u=>{try{return key(decodeURIComponent(u)).includes(key(city))}catch{return false}})||null;
  const model=(country==='TR'?loadRankingModel({metadataOnly:true}):country?loadForeignRankingModel(country,{metadataOnly:true}):null)?.metadata;
  const cards=model&&buildRaceCardFacts(future,city,model,{now});
  if(cards){views.push({...cards,entryFingerprint,mode:'model'});continue}
  const form=meeting.foreign?buildForeignFormFacts(future,city,{now}):null;
  if(form){views.push({...form,country,entryFingerprint,mode:'past_form',races:form.races.map(r=>({...r,horses:[],note:r.informative?`${cleanHorseName(r.first.name)}: görünen ${r.first.starts} sonuçta ${r.first.top3} kez ilk üç. Bu, model sırası değildir.`:'Karşılaştırılabilir geçmiş kayıt sınırlı.'}))});continue}
  views.push({city,country,mode:'program_only',sourceUrl,entryFingerprint,races:races.map(r=>({raceNo:Number(r.no),start:r.time,scheduledDate:r.scheduledDate||program.date,distance:Number(String(r.distance).match(/\d+/)?.[0])||'—',surface:r.surface,horses:[],note:'Doğrulanmış etkin model sıralaması yok.'}))});
 }
 return views;
}
