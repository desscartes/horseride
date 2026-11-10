import {readFile,writeFile} from 'node:fs/promises';
const path='data/instagram/history-catalog.json',catalog=JSON.parse(await readFile(path,'utf8'));
const known=new Set(catalog.episodes.filter(e=>e.series==='gazi').map(e=>e.year));
const decode=s=>s.replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n))).replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ');
const imported=[];
for(const page of ['54-55','56-57','58-59','60-61','62-63']){
 const url='https://medya-cdn.tjk.org/raporftp/neticekitabi2022/4.cilt/'+page+'/';
 const response=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('official_source_unavailable');
 const html=await response.text();await writeFile('data/instagram/gazi-source-'+page+'.html',html);
 const text=decode(html.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ');
 for(const row of text.matchAll(/\b(19\d{2}|20\d{2})\s+[\d,]+\s+([\s\S]*?)(?=\b(?:19\d{2}|20\d{2})\s+[\d,]+\s+|Made with)/g)){
  const year=Number(row[1]);if(year<1929||year>2022||known.has(year))continue;
  const name=row[2].match(/\d['’]\d{2}"\d{2}\s+(.+?)\s*(?:\d{1,3})?\s*$/)?.[1]?.trim();
  if(!name||name.length>65||/[<>]/.test(name))continue;
  const episode={id:'gazi-'+year,series:'gazi',country:'TR',countryLabel:'Türkiye',year,title:year+' Gazi Koşusu: '+name,topic:'horse_racing_history',reviewed:true,reviewedAt:'2026-11-02',sources:[url],tags:['#GaziKoşusu','#YarışTarihi','#AtYarışı','#GanyanZekası'],narration:`Gazi Koşusu tarihindeki yolculuğumuzda bu kez ${year} yılındayız. Türkiye Jokey Kulübü’nün resmî sonuç kitabında, bu yılın kazananı ${name} olarak kayıtlı. Her cuma bir yıl ilerlediğimiz seride, bugün bu ismi hatırlıyoruz. ${year}, Gazi Koşusu ve ${name}. Yarışın nasıl geliştiği hakkında kaynağın söylemediği ayrıntıları eklemiyoruz. Bu bölümün dayanağı sonuç kitabı; görseller ise geçmişi hatırlatan temsili canlandırmalar.`,provenance:{year,winner:name,table:'TJK2022-volume4',row:row[2]}};
  catalog.episodes.push(episode);known.add(year);imported.push({year,winner:name});
 }
}
const missing=[];for(let y=1928;y<=2022;y++)if(!known.has(y))missing.push(y);
await writeFile(path,JSON.stringify(catalog,null,2));console.log(JSON.stringify({imported,missing,episodes:catalog.episodes.length}));
