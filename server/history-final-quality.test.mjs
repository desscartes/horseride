import{test}from'node:test';import assert from'node:assert/strict';import{finalQualityApproved}from'./history-final-quality.mjs';
const actual={videoSha256:'v',voiceSha256:'a',narrationSha256:'n'};const approval={...actual,status:'approved',baseline:'fio-rito-visual-v7-native-v6',storyReviewed:true,voiceReviewed:true,visualReviewed:true};
test('render success does not approve a story',()=>assert(!finalQualityApproved({status:'rendered'},actual)));
test('changed narration or audio invalidates old review',()=>{assert(!finalQualityApproved(approval,{...actual,voiceSha256:'new'}));assert(!finalQualityApproved(approval,{...actual,narrationSha256:'new'}))});
test('all reviews and the agreed baseline are required',()=>{assert(finalQualityApproved(approval,actual));assert(!finalQualityApproved({...approval,voiceReviewed:false},actual));assert(!finalQualityApproved({...approval,baseline:'any'},actual))});
