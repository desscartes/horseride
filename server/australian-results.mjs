import {load} from 'cheerio'
const clean=v=>String(v||'').replace(/\s+/g,' ').trim()
export function parseAustralianResultEvidence(html,{date,sourceUrl,observedAt}={}){
 if(/Are you human\?|let us know that you are not a robot/i.test(html))throw Error('official_source_human_verification_required')
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Invalid source date')
 const $=load(html),venue=clean($('.race-venue').text()),month=new Date(date+'T12:00:00Z').toLocaleString('en-GB',{month:'long',timeZone:'UTC'})
 if(!new RegExp('\\b'+Number(date.slice(8))+'[,]?\\s*'+month+'\\s*'+date.slice(0,4),'i').test(venue))throw Error('Official source date mismatch')
 const races=[],rejected=[]
 for(const el of $('table.race-strip-fields').toArray()){
  const table=$(el),title=table.prevAll('table.race-title').first(),text=clean(title.text()),no=Number(title.find('.raceNum').text().match(/\d+/)?.[0]),horses=[],scratched=[],errors=[]
  if(!no)continue
  for(const tr of table.find('tr').toArray()){
   const row=$(tr),a=row.find('td.horse a').first();if(!a.length)continue
   const td=row.children('td'),name=clean(a.text()),number=Number(clean(td.eq(2).text())),href=a.attr('href'),horseCode=href?new URL(href,sourceUrl).searchParams.get('horsecode'):null
   if(row.hasClass('Scratched')){scratched.push({no:number,name,horseCode});continue}
   const label=clean(row.find('.Finish').text())
   if(!/^\d+$/.test(label)||Number(label)<=0){errors.push({no:number,name,reason:'unresolved_non_numeric_starter',label});continue}
   if(!number||!name||!horseCode){errors.push({no:number,name,reason:'missing_runner_identity'});continue}
   const weightText=clean(td.eq(8).text()),declared=Number(weightText.match(/(\d+(?:\.\d+)?)kg/)?.[1])||null,carried=Number(weightText.match(/\(cd\s*(\d+(?:\.\d+)?)kg\)/)?.[1])||null
   horses.push({no:number,name,horseCode,finishPosition:Number(label),trainer:clean(row.find('.trainer').text())||null,jockey:clean(row.find('.jockey').text())||null,barrier:Number(clean(td.eq(7).text()))||null,declaredWeight:declared,carriedWeight:carried||declared,timeSeconds:null})
  }
  if(horses.length<4)errors.push({reason:'too_few_starters'})
  if(horses.filter(h=>h.finishPosition===1).length!==1)errors.push({reason:'ambiguous_winner'})
  if(new Set(horses.map(h=>h.horseCode)).size!==horses.length||new Set(horses.map(h=>h.no)).size!==horses.length)errors.push({reason:'duplicate_runner_identity'})
  const distance=Number(text.match(/\((\d+) METRES\)/)?.[1])||null
  if(!distance)errors.push({reason:'missing_distance'})
  if(errors.length){rejected.push({date,no,errors});continue}
  const state=/INTERIM RESULTS/i.test(text)?'interim':/FINAL RESULTS|OFFICIAL RESULTS/i.test(text)?'explicit_final':'not_explicit'
  races.push({date,venue:venue.split(/\s+(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/)[0],no,distance,sourceUrl,observedAt,horses,scratched,outcomeStatus:state,admissibility:{outcomeFieldValidated:true,prestartInputsVerified:false,trainingAccepted:false},excludedFromFeatures:['finishPosition','result_time','margin','starting_price','result_going','postrace_conditions']})
 }
 return {races,rejected}
}