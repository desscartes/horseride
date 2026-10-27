import {performanceSummary} from './instagram-performance-summary.mjs'
import {shiftDay} from './maintenance-policy.mjs'
import {resultsCaption,resultPublicationDue,verifiedPrestartPublication} from './instagram-result-details.mjs'
import {readdir,readFile,mkdir,writeFile,copyFile} from 'node:fs/promises'
import {DatabaseSync} from 'node:sqlite'
import {instagramResults} from './instagram-results.mjs'
import {prospectiveOutcome} from './prospective-outcomes.mjs'
import {renderResults,uploadImages,publish} from './instagram-agent-io.mjs'
const json=async p=>JSON.parse((await readFile(p,'utf8')).replace(/^\uFEFF/,''))
export async function publishCompletedResults(root,day){
 const groups=new Map(),hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Istanbul',hour:'2-digit',hourCycle:'h23'}).format(new Date()))
 for(const folder of await readdir(root))if(/^meeting-/.test(folder))try{let record=await json(root+'/'+folder+'/publication.json'),selection=await json(root+'/'+folder+'/selection.json');if(!resultPublicationDue(selection.date,day,hour))continue;if(record.mediaId&&!record.publishedAt){await publish(folder,'Verify');record=await json(root+'/'+folder+'/publication.json')}if(!verifiedPrestartPublication(record,selection))continue;selection.publicationUrl=record.permalink;selection.publishedAt=record.publishedAt;if(!groups.has(selection.date))groups.set(selection.date,[]);groups.get(selection.date).push(selection)}catch{}
 const evaluations=new Map(),db=new DatabaseSync('data/horseride.sqlite',{readOnly:true});
 try{for(const [date,selections]of groups){const outcomes=new Map();for(const r of db.prepare('SELECT city,race_no,race_json,results_json FROM historical_race_data WHERE date=?').iterate(date))outcomes.set(`${date}:${r.city}:${r.race_no}`,prospectiveOutcome(JSON.parse(r.race_json),new Map(JSON.parse(r.results_json))));evaluations.set(date,instagramResults(selections,outcomes));}}finally{db.close()}
 if(groups.size)await writeFile(root+'/performance-report.json',JSON.stringify({checkedAt:new Date().toISOString(),...performanceSummary([...evaluations].map(([date,result])=>({date,result})),shiftDay(day,-1))},null,2));
 const urls=[]
 for(const [date]of groups){const id='results-'+date,directory=root+'/'+id;let old;try{old=await json(directory+'/publication.json')}catch{}if(old?.mediaId||old?.status==='publishing_unknown')continue
  let prepared;try{prepared=await json(directory+'/manifest.json')}catch(e){if(e.code!=='ENOENT')throw e}
  if(prepared){await publish(id,'Prepare');await publish(id,'Publish');const saved=await json(directory+'/publication.json');if(saved.permalink)urls.push(saved.permalink);continue}
  const result=evaluations.get(date);if(result.pending||!result.meetings)continue
  await mkdir(directory,{recursive:true});const paths=await renderResults(date,result,directory),images=await uploadImages(id,paths);await copyFile(paths[0],directory+'/image.jpg')
  const caption=resultsCaption(date,result);if(caption.length>2200)throw Error('Result caption too long')
  const manifest={id,account:'ganyan_zekasi',instagramId:'17841441483231653',localImage:'image.jpg',imageSha256:images[0].sha256,imageUrl:images[0].url,images:images.length>1?images:undefined,caption,altText:'Yayımlanmış şehir kuponlarının resmî sonuç takibi.'}
  await writeFile(directory+'/manifest.json',JSON.stringify(manifest,null,2));await writeFile(directory+'/results.json',JSON.stringify(result,null,2));await publish(id,'Prepare');await publish(id,'Publish');const saved=await json(directory+'/publication.json');if(saved.permalink)urls.push(saved.permalink)
 }
 return urls
}
