// Update only reviewed coupon functions in the deployed legacy UI. A full Vite
// build from the older checkout would remove existing production screens.
import {readFile,writeFile,mkdir,copyFile,cp} from 'node:fs/promises'
import {createHash} from 'node:crypto'
const read=p=>readFile(p,'utf8'),hash=t=>createHash('sha256').update(t).digest('hex').slice(0,12)
const backup='.migration/coupon-ui-v2'
let html
try{html=await read('dist/index.html')}catch(error){
 if(error.code!=='ENOENT')throw error
 await cp('production-ui/bootstrap','dist',{recursive:true,force:false})
 html=await read('dist/index.html')
}
const current=html.match(/src="(\/assets\/[^"/]+\.js)"/)?.[1]
if(!current)throw Error('Unknown production entry')
await mkdir(backup,{recursive:true})
const original=JSON.parse(await read('production-ui/base-entry.json'))
const base=await read('production-ui/bootstrap'+original.path)
if(hash(base)!==original.hash)throw Error('Versioned production UI baseline checksum mismatch')
let previous
try{previous=JSON.parse(await read(backup+'/last-build.json'))}catch{}
if(current!==original.path&&current!==previous?.path)throw Error('Production UI changed independently; review before patching')
const replace=(text,from,to)=>{if(text.split(from).length!==2)throw Error('Patch anchor is missing or ambiguous: '+from.slice(0,90));return text.replace(from,to)}
let output=base
const ticketSource=(await read('src/data/ticketData.js')).replaceAll('\r\n','\n')
let runner=ticketSource.match(/function getRunnerCandidates\([\s\S]+?(?=\nfunction getCommentaryCandidates)/)?.[0]
let budget=ticketSource.slice(ticketSource.indexOf('export function buildBudgetTicket(')).replace(/^export /,'')
if(!runner||!budget.startsWith('function buildBudgetTicket('))throw Error('Canonical ticket functions missing')
const aliases={getRunnerCandidates:'ct',buildBudgetTicket:'pt',budgetBetTypes:'ot',getBudgetUnitPrice:'st',getCommentaryCandidates:'lt',buildTicketResult:'ft',listSelections:'ut',scoreSelection:'dt',officialMarketAllowed:'rt',validSurprise:'at',legSurpriseSuggestion:'__legSurpriseSuggestion'}
for(const [name,alias]of Object.entries(aliases)){runner=runner.replace(new RegExp('\\b'+name+'\\b','g'),alias);budget=budget.replace(new RegExp('\\b'+name+'\\b','g'),alias)}
const splice=(text,start,end,replacement)=>{const a=text.indexOf(start),b=text.indexOf(end,a+start.length);if(a<0||b<0||text.indexOf(start,a+1)>=0)throw Error('Function boundary mismatch');return text.slice(0,a)+replacement+text.slice(b)}
output=splice(output,'function ct(e,t){let n=new Set','function lt(e,t){let n=new Map',runner)
output=splice(output,'function pt(e,t,n,r,i,a=null){','function mt(e,t){let n=new Map',budget)
const start=output.indexOf('function He({date:e,city:t,cities:n,onCity:r,onRace:i}){'),end=output.indexOf('var M=e=>',start)
if(start<0||end<0)throw Error('City coupon component missing')
let component=output.slice(start,end)
component=replace(component,'[50,100].map(e=>{let n=a?.selectedMeetingCoupons?.find(t=>t.budget===e),r=n?.ticket;','(a?.selectedMeetingCoupons?.length?a.selectedMeetingCoupons:[30,50,1000].map(budget=>({budget}))).map(n=>{let e=n.budget,r=n.ticket;')
component=replace(component,'Bu hipodrom için model kapsamı en yüksek resmî altılı.','Bu hipodromdaki her resmî altılı için bütçeye göre en yüksek model kapsamı.')
component=replace(component,'children:[e,` TL bütçeli sabit altılı`]','children:e===1000?`Geniş kupon · 500–1.000 TL`:[e,` TL bütçeli sabit altılı`]')
component=replace(component,'children:t===`Tümü`?`Hipodromunu seç`:t','children:t===`Tümü`?`Hipodromunu seç`:t+(n.ordinal?` · ${n.ordinal}. altılı`:``)')
component=replace(component,'(0,j.jsx)(`div`,{className:`showcase-legs`','(0,j.jsx)(`p`,{className:`coupon-chance`,children:__couponChanceText(r.estimatedChance)}),(0,j.jsx)(`div`,{className:`showcase-legs`')
component=replace(component,'İlk öneri kaydedilir; seçimler sabittir. Hesaplanan kapsam kazanma garantisi değildir.','Bu oyun ve bütçe için model puanlarıyla en yüksek kapsam seçilir. Yüzde, ayak kapsamlarının çarpımına dayanır; gerçek sonuçlarla kalibre edilmiş başarı oranı değildir. İlk öneri saklanır, çekilen atlar başlangıçtan önce yeniden doğrulanır.')
component=replace(component,']},e)})})]})}',']},`${n.ordinal||0}-${e}`)})})]})}')
component=replace(component,'(0,j.jsx)(`strong`,{children:e.horses.map(e=>e.number).join(` · `)})','(0,j.jsx)(`strong`,{children:e.horses.map(e=>e.number).join(` · `)}),(0,j.jsx)(`small`,{className:`coupon-leg-surprise`,title:e.surpriseSuggestion?.reason,children:__surpriseSuggestionText(e.surpriseSuggestion)}),(0,j.jsx)(`small`,{className:`coupon-leg-surprise`,children:e.selectionReason})')
component=component.replace('function He(', 'function __BaseCityCoupons(')
component+='function He(props){return (0,j.jsxs)(j.Fragment,{children:[(0,j.jsx)(__BaseCityCoupons,props),(0,j.jsx)(__SelectedSocial,{date:props.date,city:props.city})]})}'
output=output.slice(0,start)+component+output.slice(end)
output=replace(output,'},e.number))})]},`${e.number}-${t.raceNo}`)','},e.number))}),(0,j.jsx)(`small`,{className:`coupon-leg-surprise`,title:t.surpriseSuggestion?.reason,children:__surpriseSuggestionText(t.surpriseSuggestion,true)})]},`${e.number}-${t.raceNo}`)')
output=replace(output,'if(n===2||!(e.retryable||e instanceof TypeError))throw e','if(n===2||!(e.retryable||e instanceof TypeError)){if(e instanceof TypeError)e.message=`Sunucuya ulaşılamadı. Bağlantı yeniden denenecek.`;throw e}')
// Versioned simulation screen shares the deployed React runtime and API address.
output=replace(output,'e===`report`?(0,j.jsx)(Ze,{})','e===`simulation`?(0,j.jsx)(__Simulation,{}):e===`report`?(0,j.jsx)(Ze,{})')
output=replace(output,'className:`mobile-bottom-nav`,"aria-label":`Ana menü`,children:[','className:`mobile-bottom-nav`,"aria-label":`Ana menü`,children:[(0,j.jsxs)(`button`,{className:e===`simulation`?`active`:``,onClick:()=>{t(`simulation`),window.scrollTo({top:0})},children:[(0,j.jsx)(`span`,{children:`◇`}),`Simülasyon`]}),')
output=replace(output,'className:e===`report`?`nav-item active`:`nav-item`,onClick:()=>t(`report`)','className:e===`simulation`?`nav-item active`:`nav-item`,onClick:()=>t(`simulation`),children:`◇ Simülasyon`}),(0,j.jsxs)(`button`,{className:e===`report`?`nav-item active`:`nav-item`,onClick:()=>t(`report`)')
output=replace(output,'children:e===`report`?`Uygulama raporu`','children:e===`simulation`?`Simülasyon`:e===`report`?`Uygulama raporu`')
output=replace(output,'children:e===`report`?`Tahmin, ilk üç başarısı ve altılı sonuçları.`','children:e===`simulation`?`Modelin günlük sanal altılı seçimleri ve sonuçları.`:e===`report`?`Tahmin, ilk üç başarısı ve altılı sonuçları.`')
const socialView=await read('src/data/selectedSocialView.js'),socialViewFile=`selected-social-${hash(socialView)}.js`
output=`import {renderSelectedSocial as __renderSelectedSocial} from "./${socialViewFile}";\nfunction __SelectedSocial(props){return __renderSelectedSocial(s,T,props)}\n`+output
await writeFile('dist/assets/'+socialViewFile,socialView)
const simulationView=await read('src/data/simulationView.js'),simulationViewFile=`simulation-view-${hash(simulationView)}.js`
output=`import {renderSimulation as __renderSimulation} from "./${simulationViewFile}";\nfunction __Simulation(){return __renderSimulation(s,T)}\n`+output
await writeFile('dist/assets/'+simulationViewFile,simulationView)
output='import {couponChanceText as __couponChanceText} from "./coupon-chance-v1.js";\nimport {legSurpriseSuggestion as __legSurpriseSuggestion,surpriseSuggestionText as __surpriseSuggestionText} from "./coupon-surprise-v2.js";\n'+output
await writeFile('dist/assets/coupon-surprise-v2.js',(await read('src/data/couponSurpriseSuggestion.js')).replace("'./surprisePolicy.js'","'./coupon-surprise-policy-v2.js'"))
await copyFile('src/data/surprisePolicy.js','dist/assets/coupon-surprise-policy-v2.js')
await copyFile('src/data/couponChance.js','dist/assets/coupon-chance-v1.js')
// Show the same truthful outside-main alternative in the race screen as on coupon legs.
output=replace(output,'children:`★ Sürpriz aday`','children:`★ Sürpriz / alternatif`')
output=replace(output,'Ie?Ie.surpriseAssessment?.reason||`Favori dışındaki atlar incelendi; desteklenen aday olduğunda gerekçesi burada gösterilir.`:`Sürpriz aday ve gerekçesi, günlük AI analizi tamamlandığında burada görünür.`','__raceAlternativeText(k,Ie)')
output='function __raceAlternativeText(race,prediction){const a=__legSurpriseSuggestion(race,prediction);return a.available?__surpriseSuggestionText(a)+". "+a.reason:a.reason}\n'+output
const transport=await read('src/data/ngrokTransport.js'),transportFile='ngrok-transport-'+hash(transport)+'.js'
await writeFile('dist/assets/'+transportFile,transport)
output='import "./'+transportFile+'";\n'+output
output=replace(output,'providerUrls:e.providerUrls,failures:e.failures,message:e.message','fetchedAt:e.fetchedAt,providerUrls:e.providerUrls,failures:e.failures,message:e.message')
output=replace(output,'x.source===`live`?`Program güncel`','x.source===`live`?__programState(x)')
output=replace(output,'x.source===`live`?`Program hazır`','x.source===`live`?__programState(x)')
output=replace(output,'o.filter(e=>e.city===k.city).length,` koşu · `','x.source===`loading`?`Yükleniyor`:o.filter(e=>e.city===k.city).length,` koşu · `')
output='function __programState(x){const age=(Date.now()-Date.parse(x.fetchedAt))/60000;return !Number.isFinite(age)?"Program alındı":age>30?"Önbellekteki program":"Program alındı"}\n'+output
output=replace(output,'children:`AT GEÇMİŞİ`','children:`KAYDEDİLMİŞ TAHMİN GEÇMİŞİ`')
output=replace(output,'children:`Önceki yarışlar getiriliyor…`','children:`Kaydedilmiş program ve tahminler getiriliyor…`')
output=replace(output,'function __raceAlternativeText(race,prediction){const a=','function __raceAlternativeText(race,prediction){if(!race?.horses?.length)return "Program yükleniyor; sürpriz değerlendirmesi henüz yapılamıyor.";const a=')
output=replace(output,'o&&(0,j.jsxs)(j.Fragment,{children:[(0,j.jsxs)(`p`,{className:`report-note`','o&&(0,j.jsxs)(j.Fragment,{children:[o._delivery&&(0,j.jsx)(`p`,{role:`status`,className:`report-note`,children:`Son başarılı rapor: ${new Date(o._delivery.preparedAt).toLocaleString("tr-TR")}${o._delivery.stale?" · Güncelleme sürüyor; önbellekteki sonuçlar gösteriliyor.":""}`}),(0,j.jsxs)(`p`,{className:`report-note`')
// Keep uncertain model coverage visible next to the weakest leg.
output=replace(output,'children:__couponChanceText(r.estimatedChance)}),','children:__couponChanceText(r.estimatedChance)}),r.riskSummary&&(0,j.jsx)(`p`,{className:`coupon-risk`,children:`En kırılgan ayak: ${r.riskSummary.raceNo}. koşu · ${r.riskSummary.selectedRunners} at · hesaplanan kapsam %${(100*r.riskSummary.estimatedCoverage).toFixed(1)}`}),')
const path=`/assets/index-coupon-v2-${hash(output)}.js`
await writeFile('dist'+path,output)
await writeFile('dist/assets/coupon-ui-v2.css','.coupon-leg-surprise{display:block!important;white-space:normal;line-height:1.5;font-size:11px;color:#9bdbc5;margin-top:8px;overflow-wrap:anywhere}.coupon-slip-leg .coupon-leg-surprise{padding:4px;max-width:100px;font-size:10px}')
let next=html.replace(current,path)
if(!next.includes('/assets/coupon-ui-v2.css'))next=next.replace('</head>','<link rel="stylesheet" href="/assets/coupon-ui-v2.css">\n</head>')
await writeFile('dist/index.html',next)
await writeFile(backup+'/last-build.json',JSON.stringify({path,builtAt:new Date().toISOString(),canonicalFunctions:['getRunnerCandidates','buildBudgetTicket'],base:original.path},null,2))
await writeFile('dist/assets/simulation-v1.css','.mobile-bottom-nav{grid-template-columns:repeat(5,minmax(0,1fr))!important}.simulation-view{padding:16px 0 80px}.simulation-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px}.simulation-stat,.simulation-ticket{padding:20px;border:1px solid #344b5b;border-radius:22px;background:#102331;margin:14px 0}.simulation-stat strong,.simulation-stat small,.simulation-legs strong,.simulation-legs small{display:block}.simulation-stat strong{font-size:22px;margin-top:8px}.simulation-legs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:16px 0}.simulation-legs>div{background:#091722;padding:10px;border-radius:10px;overflow-wrap:anywhere}.simulation-note{font-size:12px;line-height:1.7;color:#a6b9c8}')
let finalHtml=await read('dist/index.html');if(!finalHtml.includes('/assets/simulation-v1.css'))await writeFile('dist/index.html',finalHtml.replace('</head>','<link rel="stylesheet" href="/assets/simulation-v1.css">\n</head>'))
console.log(JSON.stringify({path,base:original.path,bytes:Buffer.byteLength(output)}))
