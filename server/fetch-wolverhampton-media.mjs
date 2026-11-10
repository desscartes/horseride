import {mkdir,writeFile} from 'node:fs/promises';
const titles=['File:Dunstall Park racecourse, Wolverhampton - geograph.org.uk - 205319.jpg','File:Dunstall Park racecourse, Wolverhampton - geograph.org.uk - 642520.jpg','File:Helen Duncan Atkinson (1849-1924) - Wolverhampton Racecourse - OP603 - Wolverhampton Art Gallery.jpg','File:Horse racing at Wolverhampton Racecourse - geograph.org.uk - 8357581.jpg'];
const u=new URL('https://commons.wikimedia.org/w/api.php');u.search=new URLSearchParams({action:'query',titles:titles.join('|'),prop:'imageinfo',iiprop:'url|extmetadata',iiurlwidth:'1600',format:'json'});
const headers={'User-Agent':'HorseRideHistory/1.0 (documentary source and attribution lookup)'};
const response=await fetch(u,{headers,signal:AbortSignal.timeout(20000)});const j=await response.json();
const dir='public/social/history-venues/wolverhampton';await mkdir(dir,{recursive:true});const entries=[];
for(const title of titles){const p=Object.values(j.query.pages).find(p=>p.title===title);if(!p?.imageinfo?.length)throw Error('source_file_missing');
 const info=p.imageinfo[0],m=info.extmetadata;const license=m.LicenseShortName?.value;
 if(!['Public domain','CC BY-SA 2.0'].includes(license))throw Error('unverified_visual_license');
 const url=info.url;let r=await fetch(url,{headers,signal:AbortSignal.timeout(30000)});
 if(r.status===429){const wait=Math.min(60,Math.max(20,Number(r.headers.get('retry-after'))||30));await new Promise(resolve=>setTimeout(resolve,wait*1000));r=await fetch(url,{headers,signal:AbortSignal.timeout(30000)})}
 if(!r.ok)throw Error('media_download_'+r.status);
 const local=dir+'/'+entries.length+'.jpg';await writeFile(local,Buffer.from(await r.arrayBuffer()));
 entries.push({title,local,url,source:info.descriptionurl,author:m.Artist?.value.replace(/<[^>]*>/g,'').trim(),license,licenseUrl:m.LicenseUrl?.value,description:m.ImageDescription?.value.replace(/<[^>]*>/g,'').trim(),date:m.DateTimeOriginal?.value});
}
await writeFile(dir+'/rights.json',JSON.stringify(entries,null,2));console.log(JSON.stringify(entries.map(({local,author,license,date})=>({local,author,license,date}))));
