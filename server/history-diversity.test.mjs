import {test} from 'node:test';import assert from 'node:assert/strict';import {checkMotionDiversity} from './history-diversity.mjs';
const clips=()=>Object.fromEntries(['portrait','gait','infield','rail'].map((r,i)=>[r,{sha256:'hash-'+i,sourceId:'source-'+i}]));
test('reencoding a previously published source cannot bypass the reuse guard',()=>{const c=clips();c.portrait.sha256='new-encoding';assert.equal(checkMotionDiversity(c,[{episode:'previous',assets:['source-0']}],'new').ok,false)});
test('one photo cannot fill two shots under different encodings',()=>{const c=clips();c.rail.sourceId=c.portrait.sourceId;const result=checkMotionDiversity(c,[],'new');assert.equal(result.ok,false);assert.deepEqual(result.repeatedWithinEpisode,['source-0'])});
test('four distinct unpublished sources remain eligible for visual review',()=>assert.equal(checkMotionDiversity(clips(),[],'new').ok,true));
