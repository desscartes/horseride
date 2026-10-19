import {mkdirSync,readFileSync,writeFileSync,renameSync,existsSync,unlinkSync} from 'node:fs'
import {resolve,dirname} from 'node:path'
const path=()=>resolve(process.env.HORSERIDE_ANALYSIS_ACCESS_FILE||'data/maintenance/analysis-access.json')
export const billingCodes=new Set(['insufficient_quota','credit_balance_exhausted','organization_spend_limit_exceeded','project_spend_limit_exceeded','organization_usage_limit_exceeded'])
export function analysisAccessStatus(){try{return JSON.parse(readFileSync(path(),'utf8'))}catch{return {blocked:false}}}
export function pauseAnalysisAccess(code){
 if(!billingCodes.has(code))return
 const file=path(),temp=`${file}.${process.pid}.tmp`;mkdirSync(dirname(file),{recursive:true})
 writeFileSync(temp,JSON.stringify({blocked:true,code,since:new Date().toISOString()}));renameSync(temp,file)
}
export function clearAnalysisAccess(){if(existsSync(path()))unlinkSync(path())}
export function assertAnalysisAccess(){const status=analysisAccessStatus();if(status.blocked&&!(process.env.HORSERIDE_ANALYSIS_PROVIDER==='local'&&billingCodes.has(status.code)))throw Object.assign(Error(status.code==='deployment_pause'?'Yorum sunucuda hazırlanıyor; güncelleme tamamlandığında otomatik gösterilecek.':'AI yorum servisi geçici olarak kapalı. Sunucu tarafındaki servis bakiyesi yenilenmeli. Kaydedilmiş yorumlar ve veri sıralaması kullanılabilir.'),{status:503,code:status.code})}
