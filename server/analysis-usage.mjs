import {DatabaseSync} from 'node:sqlite'
import {mkdirSync} from 'node:fs'
import {dirname,resolve} from 'node:path'
import {createHash,randomUUID} from 'node:crypto'
import {localDay} from './maintenance-policy.mjs'
export function createUsageLedger(file,{tokenLimit=200000,callLimit=40,now=Date.now,day=()=>localDay()}={}){
 mkdirSync(dirname(resolve(file)),{recursive:true});const db=new DatabaseSync(file)
 db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS calls(id TEXT PRIMARY KEY,day TEXT,hash TEXT,status TEXT,charged INTEGER,input INTEGER,output INTEGER,cached INTEGER,reasoning INTEGER,started INTEGER,response TEXT); CREATE INDEX IF NOT EXISTS calls_hash ON calls(hash);')
 const summary=()=>{const row=db.prepare('SELECT COUNT(*) AS calls,COALESCE(SUM(charged),0) AS charged,COALESCE(SUM(input),0) AS inputTokens,COALESCE(SUM(output),0) AS outputTokens,COALESCE(SUM(cached),0) AS cachedInputTokens,COALESCE(SUM(reasoning),0) AS reasoningTokens FROM calls WHERE day=?').get(day());return {...row,date:day(),tokenLimit,callLimit,remainingTokens:Math.max(0,tokenLimit-row.charged),remainingCalls:Math.max(0,callLimit-row.calls),note:'Bu sürümden itibaren sağlayıcının bildirdiği kullanım ölçülür. Bekleyen veya sonucu belirsiz çağrılar için ihtiyatlı tahmin rezervi tutulur; önbellekten gösterim yeni çağrı değildir.'}}
 return {summary,close:()=>db.close(),reserve(body){
  const hash=createHash('sha256').update(body).digest('hex');db.exec('BEGIN IMMEDIATE')
  try{
   const ready=db.prepare("SELECT response FROM calls WHERE hash=? AND status='ready' ORDER BY started DESC LIMIT 1").get(hash)
   if(ready){db.exec('COMMIT');return {payload:JSON.parse(ready.response),cached:true}}
   db.prepare("UPDATE calls SET status='uncertain' WHERE status='pending' AND started<?").run(now()-3*60000)
   const active=db.prepare("SELECT 1 FROM calls WHERE hash=? AND (status='pending' OR (status='uncertain' AND started>?))").get(hash,now()-15*60000)
   if(active)throw Object.assign(Error('Aynı yorum sunucuda hazırlanıyor; yeni çağrı açılmadı.'),{status:409,code:'analysis_inflight'})
   let output=12000;try{output=Math.max(0,Number(JSON.parse(body).max_output_tokens)||12000)}catch{}
   // Reserve a conservative estimate (2 UTF-8 bytes per input token),
   // replaced by actual API usage when a response arrives. Not a billing cap.
   const estimated=Math.ceil(Buffer.byteLength(body)/2)+output,usage=summary()
   const pending=db.prepare("SELECT COALESCE(SUM(charged),0) AS total FROM calls WHERE day=? AND status='pending'").get(day()).total
   if(usage.calls<callLimit&&pending>0&&usage.charged+estimated>tokenLimit&&usage.charged-pending+estimated<=tokenLimit)throw Object.assign(Error('Diğer yorumların tamamlanması bekleniyor.'),{status:409,code:'analysis_capacity_busy'})
   if(usage.calls>=callLimit||usage.charged+estimated>tokenLimit)throw Object.assign(Error('Günlük yorum kullanım sınırına ulaşıldı. Kaydedilmiş yorumlar kullanılabilir.'),{status:429,code:'daily_analysis_budget'})
   const id=randomUUID();db.prepare('INSERT INTO calls VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,day(),hash,'pending',estimated,0,0,0,0,now(),null);db.exec('COMMIT');return {id}
  }catch(error){db.exec('ROLLBACK');throw error}
 },finish(reservation,payload,{ok=false,uncertain=false}={}){
  if(!reservation?.id)return
  const usage=payload?.usage,input=Number(usage?.input_tokens)||0,output=Number(usage?.output_tokens)||0,cached=Number(usage?.input_tokens_details?.cached_tokens)||0,reasoning=Number(usage?.output_tokens_details?.reasoning_tokens)||0
  const known=usage&&Number.isFinite(Number(usage.input_tokens))&&Number.isFinite(Number(usage.output_tokens))
  db.prepare('UPDATE calls SET status=?,charged=CASE WHEN ? THEN ? WHEN ? THEN charged ELSE 0 END,input=?,output=?,cached=?,reasoning=?,response=? WHERE id=?').run(uncertain?'uncertain':ok?'ready':'failed',Number(Boolean(known)),input+output,Number(Boolean(uncertain||ok&&!known)),input,output,cached,reasoning,ok?JSON.stringify(payload):null,reservation.id)
 }}
}
let ledger
export function analysisUsageLedger(){return ledger||=createUsageLedger(process.env.HORSERIDE_ANALYSIS_USAGE_FILE||'data/maintenance/analysis-usage.sqlite',{tokenLimit:Number(process.env.HORSERIDE_AI_DAILY_TOKEN_LIMIT)||200000,callLimit:Number(process.env.HORSERIDE_AI_DAILY_CALL_LIMIT)||40})}
