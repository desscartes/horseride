import test from 'node:test'
import assert from 'node:assert/strict'
import {supportsIntelligenceRevision} from './intelligence-artifact-policy.mjs'
const metadata={pipelineRevision:5,featurePipeline:'intelligence_context_v1',country:'US',priorRaceContextSchemaVersion:1,intelligenceSchemaVersion:2,searchSelection:'frozen_parent_earlier_validation_parameters',parentStudyMethod:'frozen-parent',trainingParameters:{iterations:186,depth:4,learning_rate:.045,l2_leaf_reg:3},trees:186,depth:4}
test('context pipeline requires explicit schema, US and frozen parent parameters',()=>{
 assert.equal(supportsIntelligenceRevision(metadata),true)
 for(const change of [{country:'TR'},{priorRaceContextSchemaVersion:undefined},{intelligenceSchemaVersion:1},{parentStudyMethod:''},{searchSelection:'earlier_validation_log_loss_only'},{trees:200}])assert.equal(supportsIntelligenceRevision({...metadata,...change}),false)
 assert.equal(supportsIntelligenceRevision({pipelineRevision:2}),true)
})
