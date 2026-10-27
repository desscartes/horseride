import {analysisEntryFingerprint} from './analysis-entry-policy.mjs'
// Canonicalize the public CSV representation exactly as database.listDailyRaces does.
export function canonicalEntries(rows){
 return rows.toSorted((a,b)=>Number(a.no)-Number(b.no)).map(r=>({...r,horses:r.horses.toSorted((a,b)=>Number(a.no)-Number(b.no)).map(h=>{
 const i=h.sourceData?.headers?.findIndex(x=>x==='H'||x==='HP')??-1;
 const value=i>=0?Number(h.sourceData.values?.[i]):NaN;
 return {...h,handicapRating:h.handicapRating??(Number.isFinite(value)?value:null)};
 })}));
}

export function publicationEntriesMatch(a,b){
 const left=canonicalEntries(a),right=canonicalEntries(b),parents=rows=>JSON.stringify(rows.map(r=>[r.no,r.scheduledDate,r.horses.map(h=>[h.no,h.sire??null,h.dam??null])]));
 return analysisEntryFingerprint(left)===analysisEntryFingerprint(right)&&parents(left)===parents(right);
}
