// Apply only to explanatory prose, never horse names or structured identifiers.
export function analysisProse(value){
 return String(value||'').normalize('NFC')
  .replace(/\b(?:gpt[-\w.]*|qwen[\w:.-]*|ollama|catboost|openai|walk[- ]forward|local_(?:trained|catboost)[\w.-]*|(?:baseline|performance|pedigree|intelligence)[_-]v\d[\w.-]*)\b/gi,'analiz sistemi')
  .replace(/\b(?:horsePerformance|analysisCandidates|evidenceCoverage|weatherForecast|paceEvidence|speedEvidenceCount)\b/g,'veri kaydı')
  .replace(/\byarış içi model payı\b/gi,'yarış içi göreli puan')
  .replace(/\bmodel sıralaması\b/gi,'aday sıralaması')
  .replace(/\bmodel puanı\b/gi,'göreli puan')
  .replace(/\bmodel\b/gi,'analiz')
  .replace(/\s+/g,' ').replace(/\s+([,.;:!?])/g,'$1').trim()
}
export function publicAnalysis(analysis){
 if(!analysis)return analysis
 const {rankingSignature,publishedCandidateSignature,...visible}=analysis
 return {...visible,summary:analysisProse(analysis.summary),races:(analysis.races||[]).map(r=>({...r,picks:(r.picks||[]).map(p=>({...p,reason:analysisProse(p.reason)})),risks:analysisRisks(r),surprise:r.surprise?{...r.surprise,reason:analysisProse(r.surprise.reason)}:null}))}
}
function analysisRisks(race){
 const evidence=race.evidence||{}
 const risks=(race.risks||[]).map(analysisProse).filter(text=>{
  if(!/hiçbir at|hiçbirinin|tüm atların|bütün atların/i.test(text)||!/yok|bulunmuyor|bulunmamaktadır|bulunmamakta/i.test(text))return true
  if(/mesafe|metre|\d+m\b/i.test(text)&&/pist|yüzey|çim|kum|sentetik/i.test(text)&&evidence.withDistanceAndSurface>0)return false
  if(/idman|galop/i.test(text)&&evidence.withWorkout>0)return false
  if(/jokey/i.test(text)&&evidence.withJockeyHistory>0)return false
  return true
 })
 if(Number.isInteger(evidence.runners)&&Number.isInteger(evidence.withDistanceAndSurface)&&evidence.runners>evidence.withDistanceAndSurface)risks.push(`${evidence.runners-evidence.withDistanceAndSurface}/${evidence.runners} at için yakın mesafede ve aynı pist yüzeyinde geçmiş yarış kaydı bulunmuyor.`)
 return [...new Set(risks)]
}
export function analysisError(error){
 const message=String(error?.message||error||'')
 if(error?.code==='local_analysis_unavailable'||/yerel yorum hazırlanamadı/i.test(message))return 'Yorum sunucuda tamamlanamadı. Kayıtlı yorumlar korunuyor; ücretli servise geçilmedi.'
 if(error?.code==='daily_analysis_budget'||/günlük yorum kullanım sınırı/i.test(message))return 'Günlük yorum kullanım sınırına ulaşıldı. Hazır yorumlar ve veri sıralaması kullanılabilir.'
 if(/yorum servisi.*kapalı|servis bakiyesi yenilenmeli|credit_balance_exhausted|insufficient_quota|spend_limit_exceeded|usage_limit_exceeded/i.test(message)||['credit_balance_exhausted','insufficient_quota','organization_spend_limit_exceeded','project_spend_limit_exceeded','organization_usage_limit_exceeded'].includes(error?.code))return 'Yeni AI yorumları şu anda kullanılamıyor. Sunucu tarafındaki servis bakiyesi yenilenmeli. Kaydedilmiş yorumlar ve veri sıralaması kullanılabilir.'
 if(/program.*değiş|aday sırası.*değiş/i.test(message))return 'Yarış bilgileri güncellendi. Güncel yorum hazırlanıyor; kısa süre sonra tekrar deneyebilirsin.'
 if(/429|rate.limit|quota/i.test(message))return 'Yorum servisi şu anda yoğun. Kısa süre sonra tekrar deneyebilirsin.'
 if(/timeout|zaman aşımı|abort|bağlantı|fetch/i.test(message))return 'Yorum servisine bağlantı gecikti. Hazır olan yorumlar korunuyor; tekrar deneyebilirsin.'
 if(/hazırlan|sunucuda sürüyor/i.test(message))return 'Yorum hazırlanıyor. Tamamlandığında otomatik gösterilecek.'
 return 'Yorum şu anda tamamlanamadı. Hazır olan yorumlar korunuyor; tekrar deneyebilirsin.'
}
