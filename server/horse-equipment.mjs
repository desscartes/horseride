// Retain only equipment explicitly printed in the official entry; absence of
// suffixes alone does not prove that a horse ran without equipment.
export function horseEquipment(horse){
 for(const key of ['equipment','accessories'])if(horse[key]!=null)return String(horse[key]).trim()||'NONE'
 const headers=horse.sourceData?.headers||[],values=horse.sourceData?.values||[]
 const index=headers.findIndex(h=>/^(takı|taki|equipment|accessories)$/i.test(String(h).trim()))
 if(index>=0)return String(values[index]||'').trim()||'NONE'
 const match=String(horse.name||'').replace(/\s*\(\s*koşmaz\s*\)\s*$/i,'').match(/(?:\s+(?:KG|DB|SKG|SKUL|SK|K|ÖG|OG|GKR|SGKR|DS|YP|BB))+$/i)
 return match?match[0].trim().toUpperCase().split(/\s+/).sort().join(' '):null
}
