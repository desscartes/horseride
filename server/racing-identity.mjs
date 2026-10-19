import {horseIdentity} from './data-quality.mjs'
// Only standalone official equipment suffixes are stripped. Registry IDs have
// occasional contradictory archived labels and are not blindly merged.
export const horseIdentityV2=name=>horseIdentity(String(name||'').replace(/(?:\s+(?:KG|DB|SKG|SKUL|SK|K|ÖG|OG|GKR|SGKR|DS|YP|BB))+$/gi,''))
export const jockeyIdentityV2=name=>horseIdentity(String(name||'').replace(/\s+AP$/i,''))
