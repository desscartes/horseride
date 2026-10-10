import test from 'node:test'
import assert from 'node:assert/strict'
import {createRankingHistory,raceFeatures,addRaceToHistory,evaluateTreeModel,featureNames,rankRaceLocally} from './ranking.mjs'

const race={city:'Bursa',no:1,distance:'1400m',surface:'Çim',type:'Maiden',horses:[{no:1,name:'A KG',weight:55,jockey:'J',trainer:'T'},{no:2,name:'B DB',weight:57,jockey:'K',trainer:'U'}],results:new Map([[1,{finishPosition:1,timeSeconds:90}],[2,{finishPosition:2,timeSeconds:91}]])}
test('feature vectors use only prior-day results and preserve horse identity',()=>{
  const history=createRankingHistory()
  const original=raceFeatures(race,'2026-10-04',history)
  assert.equal(original[0].length,featureNames.length)
  addRaceToHistory(history,race,'2026-10-04')
  assert.deepEqual(raceFeatures(race,'2026-10-04',history),original)
  const tomorrow=raceFeatures({...race,horses:race.horses.map(h=>({...h,name:h.name.replace(' KG',' K')}))},'2026-10-05',history)
  assert.equal(tomorrow[0][featureNames.indexOf('historyStarts')],1)
  assert.ok(tomorrow[0][featureNames.indexOf('winRate')]>original[0][featureNames.indexOf('winRate')])
})
test('numeric CatBoost JSON inference follows feature indexes and tree leaf bits',()=>{
  const model={features_info:{float_features:[{feature_index:0,flat_feature_index:2}]},oblivious_trees:[{splits:[{split_type:'FloatFeature',float_feature_index:0,border:5}],leaf_values:[-1,2]}],scale_and_bias:[2,[.5]]}
  assert.equal(evaluateTreeModel(model,[100,100,4]),-1.5)
  assert.equal(evaluateTreeModel(model,[0,0,6]),4.5)
})
test('v2 identity recovers equipment and apprentice histories without merging registry labels',()=>{
 const history=createRankingHistory({identityVersion:2})
 const previous={...race,horses:race.horses.map((h,i)=>({...h,name:i?'B DB':'A KG SK SGKR',jockey:i?'K':'J AP'}))}
 addRaceToHistory(history,previous,'2026-10-04')
 const today={...race,horses:race.horses.map((h,i)=>({...h,name:i?'B':'A DB YP BB',jockey:i?'K':'J'}))}
 const vectors=raceFeatures(today,'2026-10-05',history)
 assert.equal(vectors[0][featureNames.indexOf('historyStarts')],1)
 assert.equal(vectors[0][featureNames.indexOf('jockeyWin')],2/11)
 assert.equal(vectors[0][featureNames.indexOf('partnershipWin')],2/11)
 assert.deepEqual(raceFeatures(today,'2026-10-04',history),raceFeatures(today,'2026-10-04',createRankingHistory({identityVersion:2})))
})


test('AGF, market share and incoming baseline scores cannot change model feature vectors',()=>{
 const history=createRankingHistory({identityVersion:2})
 addRaceToHistory(history,race,'2026-10-03')
 const first={...race,horses:race.horses.map((h,i)=>({...h,marketShare:i?90:10,probability:i?95:5,agf:i?1:2}))}
 const second={...race,horses:race.horses.map((h,i)=>({...h,marketShare:i?10:90,probability:i?5:95,agf:i?2:1}))}
 assert.deepEqual(raceFeatures(first,'2026-10-07',history),raceFeatures(second,'2026-10-07',history))
})

test('market changes leave final locally ranked scores and model probabilities unchanged',()=>{
 const model={features_info:{float_features:[{feature_index:0,flat_feature_index:0}]},oblivious_trees:[{splits:[{split_type:'FloatFeature',float_feature_index:0,border:56}],leaf_values:[-1,2]}],scale_and_bias:[1,[0]]}
 const bundle={model,metadata:{method:'market-independence-test',trainedThrough:'2026-10-04',temperature:1,featureIndexes:[8],featurePipeline:'performance_v2'}}
 const history=createRankingHistory({identityVersion:2})
 const input=invert=>({...race,horses:race.horses.map((h,i)=>({...h,marketShare:(Boolean(i)!==invert)?95:5,probability:(Boolean(i)!==invert)?95:5}))})
 const selected=r=>r.horses.map(h=>({no:h.no,score:h.rankingScore,probability:h.probability}))
 assert.deepEqual(selected(rankRaceLocally(input(false),'2026-10-07',history,bundle)),selected(rankRaceLocally(input(true),'2026-10-07',history,bundle)))
})
