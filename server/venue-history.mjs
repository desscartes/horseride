import {createHash} from 'node:crypto';
export const venueKey=s=>String(s||'').toLocaleLowerCase('tr-TR').replace(/ı/g,'i').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
export function matchStoryVenue(story,program,day,now=Date.now()){
 if(story.interestingStory!==true||!story.venueAliases?.length)return null;
 const cities=[...new Set((program.races||[]).map(r=>r.city))];
 for(const city of cities){
  if(!story.venueAliases.some(a=>venueKey(city).startsWith(venueKey(a))))continue;
  const upcoming=(program.races||[]).filter(r=>r.city===city&&(r.scheduledDate||day)===day).map(r=>Date.parse(`${day}T${String(r.time).replace('.',':')}:00+03:00`)).filter(t=>t>now+5*60000);
  if(upcoming.length)return {city,firstUpcoming:Math.min(...upcoming)};
 }
 return null;
}
export function venueStoryPlan(story,match,day){
 const intro=`Bugün yarış koşulacak ${story.venueLabel} için, ${story.year} yılına gidiyoruz.`;
 const segments=[{text:intro,speed:.94,pauseAfter:.85},...(story.storySegments||[])];
 if(segments.length<4)throw Error('venue_story_needs_detail');
 return {...story,narration:segments.map(s=>s.text).join(' '),narrationSegments:segments,meetingCity:match.city,meetingDate:day,editorialStyle:'venue-history-v3'};
}
export async function confirmVenueProgram(story,program,day){
 const url=(program.providerUrls||[]).find(u=>story.venueAliases.some(a=>venueKey(decodeURIComponent(u)).includes(venueKey(a))));
 if(!url||new URL(url).hostname!=='medya-cdn.tjk.org'||!url.includes(day))throw Error('matching_official_venue_program_missing');
 const r=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('venue_program_http_'+r.status);
 const text=await r.text();const header=text.split(/\r?\n/)[0];
 if(!header.includes(day.split('-').reverse().join('/'))||!story.venueAliases.some(a=>venueKey(header).startsWith(venueKey(a))))throw Error('venue_program_date_or_identity_mismatch');
 const upcoming=[...text.matchAll(/\d+\. Kosu (\d{2})\.(\d{2})/g)].some(m=>Date.parse(`${day}T${m[1]}:${m[2]}:00+03:00`)>Date.now()+300000);
 if(!upcoming)throw Error('venue_meeting_has_no_upcoming_race');
 return {url,verifiedAt:new Date().toISOString(),sha256:createHash('sha256').update(text).digest('hex')};
}
