const curated={
 'gazi-1928':{horses:['Primerole'],people:['Atıf Bey'],races:['Gazi Koşusu'],venues:['Ankara'],screenFacts:['1928 · ANKARA','PRIMEROLE','Sahibi: Atıf Bey']},
 'finger-lakes-1996-fio-rito':{horses:['Fio Rito'],people:['Leslie Hulet'],races:['Whitney Handicap'],venues:['Saratoga','Finger Lakes'],screenFacts:['FIO RITO','27 KOŞU · 19 GALİBİYET','1981 · WHITNEY HANDICAP','1996 · FINGER LAKES']},
 'finger-lakes-2007-funny-cide':{horses:['Funny Cide'],races:['Wadsworth Memorial Handicap'],venues:['Finger Lakes'],screenFacts:['4 TEMMUZ 2007','FUNNY CIDE','SON START · SON GALİBİYET']},
 'finger-lakes-1962-morton':{people:['Ross Morton'],horses:['Funny Cide'],venues:['Finger Lakes','Gulfstream Park'],screenFacts:['ROSS MORTON','46 YIL · FINGER LAKES','23 YIL · GULFSTREAM PARK']},
 'wolverhampton-1993-lights':{venues:['Wolverhampton'],people:['Elizabeth II'],topics:['Yarış Tarihi'],screenFacts:['1993 · AYDINLATILAN PİST','1994 · YENİDEN AÇILIŞ','2014 · TAPETA']},
 'wolverhampton-2014-tapeta':{venues:['Wolverhampton','Newcastle'],topics:['Tapeta','Hipodrom Tarihi'],screenFacts:['2014 · WOLVERHAMPTON','ÜÇ AYLIK YENİLEME','TAPETA PİST']},
 'fontainebleau-1862-tribune':{venues:['Fontainebleau'],people:['Napoléon III','Eugénie'],topics:['Hipodrom Tarihi'],screenFacts:['1862 · FONTAINEBLEAU','350 KİŞİLİK TRİBÜN','30.000 SEYİRCİ']},
 'palermo-1908-architecture':{venues:['Palermo'],people:['Louis Faure-Dujarric'],topics:['Hipodrom Tarihi','Atçılık'],screenFacts:['1908 · PALERMO','LOUIS FAURE-DUJARRIC','KLASİK FRANSIZ MİMARİSİ']},
 'valparaiso-1885-first-derby':{venues:['Valparaiso','Viña del Mar'],races:['El Derby'],topics:['Yarış Tarihi'],screenFacts:['1882 · VIÑA DEL MAR','22 EKİM 1885','İLK DERBY']}
};
const tag=value=>'#'+String(value).normalize('NFC').replace(/[^\p{L}\p{N}]/gu,'');
export function withHistoryEntities(episode){
 const entities=curated[episode.id]||{horses:episode.provenance?.winner?[episode.provenance.winner]:[],races:episode.series==='gazi'?['Gazi Koşusu']:[],venues:episode.venueAliases?.slice(0,1)||[]};
 const values=[...(entities.horses||[]),...(entities.people||[]),...(entities.races||[]),...(entities.venues||[]),...(entities.topics||[])];
 const tags=[...new Set([...values.map(tag),...(episode.tags||[]),'#YarışTarihi'].filter(x=>x.length>1))].slice(0,5);
 const screenFacts=entities.screenFacts||[String(episode.year),...(entities.horses||[]),...(entities.races||[])];
 return {...episode,entities,tags,screenFacts};
}
