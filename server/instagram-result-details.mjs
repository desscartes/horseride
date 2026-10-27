// Retrospective evaluation only: never constructs new betting selections.
export function resultDetails(selection,outcomes){
 const get=no=>outcomes.get(`${selection.date}:${selection.city}:${no}`);
 const evaluate=no=>{const finish=get(no),field=selection.fields?.find(f=>Number(f.raceNo)===Number(no));
  if(!finish||![...finish.values()].includes(1))return {status:'pending'};
  if(!field||finish.size!==field.names.length||!field.names.every(n=>finish.has(n)))return {status:'excluded'};
  return {status:'settled',finish};
 };
 const pick=p=>{if(!p)return {status:'not_selected'};const r=evaluate(p.raceNo);if(r.status==='settled'&&!r.finish.has(p.name))r.status='excluded';return {raceNo:p.raceNo,name:p.name,number:p.number,status:r.status==='settled'?(r.finish.get(p.name)===1?'won':'lost'):r.status,finishPosition:r.finish?.get(p.name)??null,agf:null};};
 const legs=selection.ticket.legs.map(l=>{const r=evaluate(l.raceNo);return {raceNo:l.raceNo,status:r.status==='settled'?(l.horses.some(h=>r.finish.get(h.name)===1)?'won':'lost'):r.status};});
 const status=legs.some(l=>l.status==='excluded')?'excluded':legs.some(l=>l.status==='pending')?'pending':legs.every(l=>l.status==='won')?'won':'lost';
 return {date:selection.date,city:selection.city,publicationUrl:selection.publicationUrl||null,publishedAt:selection.publishedAt||null,coupon:{status,legs},first:pick(selection.first),surprise:pick(selection.surprise)};
}
export const resultLabel=status=>({won:'İsabet',lost:'İsabet etmedi',pending:'Sonuç bekleniyor',excluded:'Alan değişti · kıyas dışı',not_selected:'Aday paylaşılmadı'}[status]||'Doğrulanamadı');
export function resultsCaption(date,result){
 const header=`${date} tarihli yayımlanmış seçimlerin sonuçları.\nDeğerlendirilen: ${result.settled}/${result.meetings} şehir. Kıyas dışı: ${result.excluded}.\nAltılı isabeti: ${result.couponWins}/${result.settled}\nİlk aday isabeti: ${result.firstWins}/${result.settled}\nSürpriz isabeti: ${result.surpriseWins}/${result.surpriseEvaluated}`;
 const rows=(result.details||[]).map(d=>`${d.city}\nAltılı: ${resultLabel(d.coupon.status)}\nİlk aday: ${d.first.name||'—'} (${d.first.raceNo||'—'}. koşu) · ${resultLabel(d.first.status)}\nSürpriz: ${d.surprise.name||'—'} (${d.surprise.raceNo||'—'}. koşu) · ${resultLabel(d.surprise.status)}${d.publicationUrl?'\nÖnceki paylaşım: '+d.publicationUrl:''}`).join('\n\n');
 return header+'\n\n'+rows+'\n\nKazanan ve kaybeden tüm yayımlanmış seçimler birlikte gösterilir. Yarış öncesi AGF kaydı bulunmayan seçimler için favori dışı başarı iddiası yapılmaz. İkramiye doğrulanmadan kâr/ROI hesaplanmaz. Bu geçmiş sonuçlar gelecekteki başarıyı göstermez. 18+';
}
export function resultPublicationDue(date,day,hour){return /^\d{4}-\d{2}-\d{2}$/.test(date)&&date<day&&hour>=9;}

export function verifiedPrestartPublication(record,selection){
 const published=Date.parse(record.publishedAt),cutoff=Date.parse(selection.expiresAt);
 return record.status==='published_verified'&&/^\d+$/.test(String(record.mediaId))&&/^https:\/\/www\.instagram\.com\/p\/[A-Za-z0-9_-]+\/?$/.test(record.permalink||'')&&Number.isFinite(published)&&Number.isFinite(cutoff)&&published<=cutoff;
}
