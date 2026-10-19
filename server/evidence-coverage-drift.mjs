export function evidenceCoverageDiagnostics(splits){
 const diagnostics=[]
 for(const [field,fit] of Object.entries(splits.fit?.coverage||{})){
  const test=splits.test?.coverage?.[field],a=fit.knownPercent,b=test?.knownPercent
  if(!Number.isFinite(a)||!Number.isFinite(b)||a<0||a>100||b<0||b>100)continue
  const differencePoints=Math.round((b-a)*10)/10
  const status=a===0&&b===0?'unavailable_in_both_periods':a<5&&b>=20?'very_sparse_fit_evidence':Math.abs(differencePoints)>=20?'large_coverage_shift':null
  if(status)diagnostics.push({field,status,fitKnownPercent:a,testKnownPercent:b,differencePoints})
 }
 return {diagnostics,automaticModelChange:false,note:'Descriptive source-availability diagnostics only. These test-period summaries are not a parameter-selection or promotion rule.'}
}
