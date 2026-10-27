import {readdir,readFile,mkdir,writeFile,copyFile} from 'node:fs/promises'
import {DatabaseSync} from 'node:sqlite'
import {instagramResults} from './instagram-results.mjs'
import {prospectiveOutcome} from './prospective-outcomes.mjs'
import {renderResults,uploadImages,publish} from './instagram-agent-io.mjs'
const json=async p=>JSON.parse((await readFile(p,'utf8')).replace(/^\uFEFF/,''))
export async function publishCompletedResults(root,day){
 const groups=new Map(),hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Istanbul',hour:'2-digit',hourCycle:'h23'}).format(new Date()))
 for(const folder of await readdir(root))if(/^meeting-/.test(folder))try{const record=await json(root+'/'+folder+'/publication.json'),selection=await json(root+'/'+folder+'/selection.json');if(!record.mediaId||selection.date>day||selection.date===day&&hour<23)continue;if(!groups.has(selection.date))groups.set(selection.date,[]);groups.get(selection.date).push(selection)}catch{}
 const urls=[]
 for(const [date,selections]of groups){const id='results-'+date,directory=root+'/'+id;let old;try{old=await json(directory+'/publication.json')}catch{}if(old?.mediaId||old?.status==='publishing_unknown')continue
  const outcomes=new Map(),db=new DatabaseSync('data/horseride.sqlite',{readOnly:true});try{for(const r of db.prepare('SELECT city,race_no,race_json,results_json FROM historical_race_data WHERE date=?').iterate(date))outcomes.set(`${date}:${r.city}:${r.race_no}`,prospectiveOutcome(JSON.parse(r.race_json),new Map(JSON.parse(r.results_json))))}finally{db.close()}
  const result=instagramResults(selections,outcomes);if(result.pending||!result.settled)continue
  await mkdir(directory,{recursive:true});const paths=await renderResults(date,result,directory),images=await uploadImages(id,paths);await copyFile(paths[0],directory+'/image.jpg')
  const caption=`${date} yayımladığımız seçimlerin sonuçları.\nAltılı: ${result.couponWins}/${result.settled}\nİlk aday: ${result.firstWins}/${result.settled}\nSürpriz: ${result.surpriseWins}/${result.surpriseEvaluated}\nSonuçlanan kupon maliyeti: ${result.totalCost.toFixed(2)} TL.\nAlan değişimi nedeniyle kıyas dışı: ${result.excluded}.\nResmî ikramiye doğrulanmadığı için kâr/ROI hesaplanmadı. Yalnız kazananları seçerek paylaşmıyoruz. 18+`
  const manifest={id,account:'ganyan_zekasi',instagramId:'17841441483231653',localImage:'image.jpg',imageSha256:images[0].sha256,imageUrl:images[0].url,caption,altText:'Yayımlanmış şehir kuponlarının resmî sonuç takibi.'}
  await writeFile(directory+'/manifest.json',JSON.stringify(manifest,null,2));await writeFile(directory+'/results.json',JSON.stringify(result,null,2));await publish(id,'Prepare');await publish(id,'Publish');const saved=await json(directory+'/publication.json');if(saved.permalink)urls.push(saved.permalink)
 }
 return urls
}
