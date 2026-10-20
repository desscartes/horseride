export function supportsIntelligenceRevision(metadata){
 if(metadata?.pipelineRevision===2)return true
 const context=metadata?.pipelineRevision===5&&metadata.featurePipeline==='intelligence_context_v1'&&metadata.country==='US'&&metadata.priorRaceContextSchemaVersion===1&&metadata.intelligenceSchemaVersion===2
 const pipeline=context||metadata?.pipelineRevision===3&&metadata.featurePipeline==='intelligence_v1'||metadata?.pipelineRevision===4&&metadata.featurePipeline==='intelligence_workout_v1'&&metadata.country==='US'
 const frozenSelection=metadata.searchSelection==='frozen_parent_earlier_validation_parameters'&&typeof metadata.parentStudyMethod==='string'&&metadata.parentStudyMethod.length>0
 const selection=context?frozenSelection:['earlier_validation_log_loss_only','earlier_validation_top_one_then_brier'].includes(metadata.searchSelection)||metadata.pipelineRevision===4&&frozenSelection
 if(!pipeline||!selection)return false
 const p=metadata.trainingParameters
 return !!p&&Number.isInteger(p.iterations)&&p.iterations>0&&p.iterations===metadata.trees&&Number.isInteger(p.depth)&&p.depth>0&&p.depth===metadata.depth&&Number.isFinite(p.learning_rate)&&p.learning_rate>0&&p.learning_rate<1&&Number.isFinite(p.l2_leaf_reg)&&p.l2_leaf_reg>=0
}
