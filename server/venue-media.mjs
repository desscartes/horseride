import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {venueKey} from './venue-history.mjs';
const clean=s=>String(s||'').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').trim();
export async function ensureVenueMedia(story){
 const key=venueKey(story.venueAliases[0]),dir='public/social/history-venues/'+key;
 let assets;try{assets=JSON.parse(await readFile(dir+'/rights.json','utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
 if(!assets){
  const u=new URL('https://commons.wikimedia.org/w/api.php');u.search=new URLSearchParams({action:'query',generator:'search',gsrsearch:story.mediaSearch||story.venueAliases[0]+' racecourse',gsrnamespace:'6',gsrlimit:'12',prop:'imageinfo',iiprop:'url|extmetadata',format:'json'});
  const headers={'User-Agent':'HorseRideHistory/1.0 (documentary attribution lookup)'};
  const response=await fetch(u,{headers,signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('archive_search_http_'+response.status);
  const j=await response.json();assets=[];await mkdir(dir,{recursive:true});
  for(const page of Object.values(j.query?.pages||{})){
   const info=page.imageinfo?.[0],m=info?.extmetadata,license=m?.LicenseShortName?.value;
   if(!info||!['Public domain','CC0','CC BY 2.0','CC BY 3.0','CC BY 4.0','CC BY-SA 2.0','CC BY-SA 3.0','CC BY-SA 4.0'].includes(license))continue;
   if(!story.venueAliases.some(a=>venueKey(page.title).includes(venueKey(a)))||!/racecourse|racetrack|hippodrome|hip[oó]dromo|dunstall|horse.racing/i.test(page.title))continue;
   if(!/\.(?:jpe?g|png)$/i.test(page.title))continue;
   let r=await fetch(info.url,{headers,signal:AbortSignal.timeout(25000)});
   if(r.status===429){await new Promise(resolve=>setTimeout(resolve,Math.min(60000,Math.max(20000,Number(r.headers.get('retry-after'))*1000||30000))));r=await fetch(info.url,{headers,signal:AbortSignal.timeout(25000)})}
   if(!r.ok)continue;
   const local=dir+'/'+assets.length+'.jpg';await writeFile(local,Buffer.from(await r.arrayBuffer()));
   assets.push({local,title:page.title,author:clean(m.Artist?.value),date:clean(m.DateTimeOriginal?.value),license,licenseUrl:m.LicenseUrl?.value,source:info.descriptionurl});
   if(assets.length>=3)break;
  }
  if(assets.length<2)throw Error('insufficient_licensed_venue_images');
  await writeFile(dir+'/rights.json',JSON.stringify(assets,null,2));
 }
 // The 1882 Wolverhampton painting predates today's Dunstall Park site; do not imply it shows the 1993 event.
 assets=assets.filter(a=>!a.title.includes('Atkinson')).slice(0,3).map(a=>({...a,date:clean(a.date)}));
 if(assets.length<2)throw Error('insufficient_specific_visuals');
 return {...story,assets,visualMode:'real-venue-archive',visualDisclosure:'Gerçek hipodrom fotoğraflarıdır; üzerlerindeki tarihler çekim tarihidir. Anlatılan tarihî olayların anlık görüntüsü değildir.',visualCredits:assets.map(a=>`${a.author} (${a.date?.slice(0,10)||'tarihi belirtilmemiş'}), ${a.license}: ${a.source}`).join('\n')};
}
