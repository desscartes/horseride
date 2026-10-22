import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {verifiedStagedPedigree} from './apply-staged-pedigree.mjs'
const horse={horseId:'12',name:'A',sire:'SIRE',dam:'DAM'},html='<table><tr><td>Baba</td><td>SIRE</td></tr><tr><td>Anne</td><td>DAM / GRANDSIRE</td></tr></table>',item={horseId:'12',horse,sourceUrl:'https://www.tjk.org/TR/YarisSever/Query/ConnectedPage/AtKosuBilgileri?QueryParameter_AtId=12',sha256:createHash('sha256').update(html).digest('hex')}
test('staged ancestry needs unchanged source hash, current identity, official source and matching parents',()=>{assert.equal(verifiedStagedPedigree(item,html,horse)?.damsire,'GRANDSIRE');assert.equal(verifiedStagedPedigree(item,html+' ',horse),null);assert.equal(verifiedStagedPedigree(item,html,{...horse,sire:'OTHER'}),null);assert.equal(verifiedStagedPedigree(item,html,{...horse,name:'B'}),null);assert.equal(verifiedStagedPedigree({...item,sourceUrl:item.sourceUrl.replace('www.tjk.org','example.com')},html,horse),null);assert.equal(verifiedStagedPedigree({...item,horseId:'../x'},html,horse),null)})
