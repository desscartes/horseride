import {analysisFingerprint} from './data-quality.mjs'
// Background evidence refreshes do not discard an in-flight response.
// Entry changes still discard it; the full evidence hash controls later cache reuse.
export function analysisEntryFingerprint(races) {
  return analysisFingerprint(races.map(r=>({city:r.city,no:r.no,time:r.time,scheduledDate:r.scheduledDate,type:r.type,distance:r.distance,surface:r.surface,conditions:r.conditions,horses:r.horses.map(h=>({no:h.no,name:h.name,age:h.age,weight:h.weight,start:h.start,jockey:h.jockey,trainer:h.trainer,lastSix:h.lastSix,daysSinceRace:h.daysSinceRace,bestTimeSeconds:h.bestTimeSeconds,handicapRating:h.handicapRating}))})))
}
