import{buildRaceCardFacts}from'./race-card-facts.mjs';
const finite=n=>Number.isFinite(Number(n))?Number(n):0;
export function measureRaceEvidence(race,metadata){
 const horses=race.horses.filter(h=>!h.outOfRace),n=horses.length;if(!n)return null;
 const inputs=new Set(metadata.inputs||[]),ev=race.rankingEvidence||{};
 const speed=horses.filter(h=>finite(h.performanceEvidence?.speedEvidenceCount)>0).length;
 const pedigree=horses.filter(h=>finite(h.performanceEvidence?.pedigreeSurfaceStarts)>0).length;
 const basics=horses.filter(h=>finite(h.weight)>0&&finite(h.start)>0).length;
 const validWorkouts=ev.workoutsUsed===true&&Number.isInteger(ev.workoutRunners)&&ev.workoutRunners>=0&&ev.workoutRunners<=n;
 const workouts=inputs.has('workouts')?(validWorkouts?ev.workoutRunners:0):null;
 const weather=inputs.has('official_weather')?(ev.weatherUsed===true&&ev.weatherAvailable===true):null;
 const dimensions=[basics/n];
 if(inputs.has('normalized_past_speed'))dimensions.push(speed/n);
 if(inputs.has('pedigree_surface'))dimensions.push(pedigree/n);
 if(workouts!==null)dimensions.push(workouts/n);
 if(weather!==null)dimensions.push(weather?1:0);
 return {runners:n,speed,pedigree,basics,workouts,weather,dimensions:dimensions.length,coverage:dimensions.reduce((a,b)=>a+b,0)/dimensions.length,
  speedRecords:horses.reduce((a,h)=>a+Math.max(0,finite(h.performanceEvidence?.speedEvidenceCount)),0)};
}
export function buildEvidenceDigest(program,metadata,{now=new Date().toISOString(),limit=3}={}){
 if(!metadata||(metadata.country??'TR')!=='TR'||!metadata.enabled||metadata.trainedThrough>=program.date)return null;
 const clock=Date.parse(now),start=r=>Date.parse(`${r.scheduledDate??program.date}T${String(r.time).replace('.',':')}:00+03:00`);
 const races=program.races.filter(r=>r.rankingCountry==='TR'&&r.rankingSource==='local_trained_model'&&r.rankingMethod===metadata.method&&start(r)>clock+15*60000);
 const candidates=[];
 for(const city of new Set(races.map(r=>r.city))){
  const subset={...program,races:races.filter(r=>r.city===city)},cards=buildRaceCardFacts(subset,city,metadata,{now});if(!cards)continue;
  for(const card of cards.races){const race=subset.races.find(r=>r.no===card.raceNo),evidence=measureRaceEvidence(race,metadata);if(evidence.dimensions<3||evidence.coverage<.6||evidence.speed/evidence.runners<.5)continue;
   const ranked=race.horses.filter(h=>!h.outOfRace).toSorted((a,b)=>b.rankingScore-a.rankingScore||a.no-b.no),comparison=ranked[0]?.rankingComparison;
   const support=comparison?.supportingGroups?.filter(g=>g.scoreEffect>0).toSorted((a,b)=>b.scoreEffect-a.scoreEffect)[0]?.label;
   const risk=comparison?.riskGroups?.filter(g=>g.scoreEffect<0).toSorted((a,b)=>a.scoreEffect-b.scoreEffect)[0]?.label;
   const commentary=support?`Modelin ilk iki atı karşılaştırmasında ${support} öne çıkıyor.${risk?` ${risk.charAt(0).toLocaleUpperCase('tr-TR')+risk.slice(1)} alanı ise bu karşılaştırmada ilk atın aleyhine.`:''}`:'Karşılaştırmalı model açıklaması kaydı sınırlı; aşağıdaki notlar doğrulanmış geçmiş kayıtlardır.';
   candidates.push({city,...card,evidence,commentary,entryRace:race,sourceUrl:cards.sourceUrl,fetchedAt:cards.fetchedAt});}
 }
 candidates.sort((a,b)=>b.evidence.coverage-a.evidence.coverage||b.evidence.speedRecords-a.evidence.speedRecords||a.city.localeCompare(b.city,'tr')||a.raceNo-b.raceNo);
 if(!candidates.length)return null;
 return {date:program.date,method:metadata.method,trainedThrough:metadata.trainedThrough,scope:'Erişilen güncel Türkiye programı içinde',selectionRule:'Etkin modelde kullanılan derece, idman, soy, temel kilo/start ve hava alanlarının doluluk oranları eşit ağırlıkla karşılaştırılır. Kapsam bir kazanma olasılığı veya doğruluk ölçüsü değildir.',eligibleRaces:candidates.length,races:candidates.slice(0,limit)};
}
