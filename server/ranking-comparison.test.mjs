import test from 'node:test'
import assert from 'node:assert/strict'
import {rankingComparison,comparisonText} from './ranking-comparison.mjs'
test('pair sensitivity identifies the actual scoring group without changing vectors',()=>{const a=[8,2],b=[2,4],before=JSON.stringify([a,b]),c=rankingComparison(['jockeyWin','weight'],a,b,x=>x[0]-x[1],'RIVAL');assert.equal(c.supportingGroups[0].id,'jockey');assert.equal(JSON.stringify([a,b]),before);assert.equal(c.causal,false);assert.match(comparisonText({rankingComparison:c}),/RIVAL.*jokey/);assert.equal(rankingComparison(['jockeyWin'],[1],[2],x=>x[0],'R'),null)})
