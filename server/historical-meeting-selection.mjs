import {racingCountry} from './foreign-data.mjs'
export function selectHistoricalMeetings(meetings,{foreignOnly=false,countries=null}={}){
 if(countries!==null&&(!Array.isArray(countries)||countries.some(c=>!['TR','US','GB','FR','ZA','AU','HK','MY','IE','CA','AR','CL','AE'].includes(c))))throw Error('Unsupported historical collection country')
 return meetings.filter(m=>Boolean(m.foreign)===foreignOnly&&m.url&&(!countries||countries.includes(racingCountry(m.city)||'TR')))
}