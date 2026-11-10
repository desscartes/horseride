import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { buildForeignFormFacts } from './foreign-form-facts.mjs'

const [programPath, city, outputDirectory] = process.argv.slice(2)
if (!programPath || !city || !outputDirectory) throw Error('Usage: node render-foreign-form.mjs PROGRAM_JSON CITY OUTPUT_DIRECTORY')
const program = JSON.parse(await readFile(programPath, 'utf8'))
const facts = buildForeignFormFacts(program, city)
if (!facts) throw Error('No sufficiently complete, fresh pre-start form comparison')
await mkdir(outputDirectory, { recursive: true })

const { chromium } = await import('file:///D:/Apps/HorseRide/.migration/ui-audit-tools/node_modules/playwright/index.mjs')
const browser = await chromium.launch({ executablePath: process.env.HORSERIDE_CHROMIUM_EXE || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true,args:['--disable-gpu','--use-angle=swiftshader','--enable-unsafe-swiftshader'] })
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
const dateLabel = day => day.split('-').reverse().join('.')
const shortDate = day => day.split('-').reverse().slice(0, 2).join('.')
const cleanHorse = name => String(name ?? '')
  .replace(/\s+\((?:USA|GB|IRE|FR|GER|AUS|NZ|SAF|JPN|CAN|ARG|BRZ|CHI)\)(?=\s|$)/gi, '')
  .replace(/(?:\s+(?:KG|K|DB|SK|SKG|GKR|ÖG|TG|YP|BB|DS|AP|HKG|M))+$/i, '').trim()
const totalPages = Math.ceil(facts.races.length / 4)
const pageSize = Math.ceil(facts.races.length / totalPages)
const sourceTime = new Date(facts.fetchedAt).toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' })
const logo = (await readFile('D:/Apps/HorseRide/public/brand/ganyan-icon.png')).toString('base64')
const style = `<style>
*{box-sizing:border-box}html,body{margin:0;width:1080px;height:1350px}body{font-family:Arial,sans-serif;background:#081b26;color:#f6f1e6;padding:59px 63px;overflow:hidden;position:relative}
body:before{content:"";position:absolute;right:-240px;top:-310px;width:800px;height:800px;border-radius:50%;background:radial-gradient(circle,#b8782550,transparent 69%);pointer-events:none}
header{display:flex;align-items:center;gap:19px;color:#e8cb8b;font-size:23px;font-weight:bold;letter-spacing:2.2px;position:relative}header img{width:68px;height:68px;border-radius:50%}header small{margin-left:auto;font-size:18px;letter-spacing:1.5px}
.date{margin-top:37px;color:#d8b777;font-size:25px;letter-spacing:2px;text-transform:uppercase}h2{font-size:43px;line-height:1.1;margin:13px 0 0}h2.long{font-size:35px}.bar{height:3px;background:linear-gradient(90deg,#e5c27f,#7b9c9b,transparent);margin:17px 0 22px}
.grid{display:grid;gap:14px}.card{padding:19px 22px;border:1px solid #50616a;border-radius:17px;background:#142b35;min-height:194px}.head{display:flex;justify-content:space-between;align-items:center;color:#e8c782;font-size:24px}.head span{font-size:20px;color:#b7c8c6}.leader{font-size:29px;color:#eac985;font-weight:700;margin-top:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.leader.equal{color:#d9e6e0}.leader small{font-size:18px;color:#d4dfd8;font-weight:400}.second{font-size:22px;color:#d9e6e0;margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.meta{font-size:18px;color:#b9ceca;margin-top:10px}.tie{font-size:17px;color:#e3c582;margin-top:5px}
.note{position:absolute;left:63px;right:63px;bottom:105px;font-size:21px;line-height:1.32;color:#bdcecb}footer{position:absolute;left:63px;right:63px;bottom:52px;display:flex;justify-content:space-between;color:#e7c886;font-size:22px}
</style>`
const card = race => {
  const start = race.scheduledDate !== facts.date ? `${race.start} (${shortDate(race.scheduledDate)})` : race.start
  const detail = race.insufficientHistory
    ? '<div class="leader">Geçmiş sonuç kapsamı yetersiz</div><div class="second">Bu koşuda karşılaştırmalı form sırası gösterilmiyor.</div>'
    : race.informative
    ? `<div class="leader${race.tiedForFirst > 1 ? ' equal' : ''}">${race.first.no} ${esc(cleanHorse(race.first.name))} <small>· ilk 3: ${race.first.top3}/${race.first.starts}</small></div><div class="second">${race.second ? `${race.second.no} ${esc(cleanHorse(race.second.name))} · ilk 3: ${race.second.top3}/${race.second.starts}` : 'Diğer karşılaştırılan atlarda ilk üç bitiriş yok.'}</div>`
    : '<div class="leader">Ayırıcı geçmiş form kaydı yok</div><div class="second">Karşılaştırılan atların son sonuçlarında ilk üç bitiriş bulunmadı.</div>'
  const meta = race.insufficientHistory
    ? `Son dört veya daha fazla sonucu bulunan ${race.comparableRunners}/${race.activeRunners} at`
    : `Geçmiş ilk üç ortancası: %${race.medianTop3Percent} · karşılaştırılan ${race.comparableRunners}/${race.activeRunners} at`
  return `<article class="card"><div class="head"><strong>${race.raceNo}. KOŞU</strong><span>${esc(start)} · ${race.distance} m ${esc(race.surface)}</span></div>${detail}<div class="meta">${meta}</div>${race.informative && race.tiedForFirst > 1 ? `<div class="tie">En yüksek oranı paylaşan ${race.tiedForFirst} at var.</div>` : ''}</article>`
}
try {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 })
  for (let index = 0; index < totalPages; index++) {
    const from = index * pageSize, to = Math.min(from + pageSize, facts.races.length)
    const html = `<meta charset="utf-8">${style}<header><img src="data:image/png;base64,${logo}"> GANYAN ZEKÂSI <small>ARŞİV FORMU</small></header><div class="date">${esc(city)} · ${dateLabel(facts.date)}</div><h2 class="${city.length > 22 ? 'long' : ''}">${esc(city)} · Koşu ${from + 1}–${to}</h2><div class="bar"></div><div class="grid">${facts.races.slice(from, to).map(card).join('')}</div><div class="note">Son altı görünür sonuçta ilk üçte bitirme sayıları karşılaştırıldı; eksik koşular işaretlendi. Bu geçmiş veridir, model tahmini değildir. Kaynak: TJK · ${sourceTime} TSİ.</div><footer><span>@ganyan_zekasi</span><span>${index + 1}/${totalPages}</span></footer>`
    await page.setContent(html)
    await page.evaluate(() => document.fonts.ready)
    const overflow = await page.evaluate(() => document.querySelector('.grid').lastElementChild.getBoundingClientRect().bottom > document.querySelector('.note').getBoundingClientRect().top - 12)
    if (overflow) throw Error(`Form slide ${index + 1} layout overflow`)
    await page.screenshot({ path: resolve(outputDirectory, `slide-${index + 1}.jpg`), type: 'jpeg', quality: 94 })
  }
} finally { await browser.close() }

const lines = facts.races.map(race => race.insufficientHistory
  ? `${race.raceNo}. koşu: Geçmiş sonuç kapsamı yetersiz (${race.comparableRunners}/${race.activeRunners} at)`
  : race.informative
  ? `${race.raceNo}. koşu: ${race.first.no} ${cleanHorse(race.first.name)} ${race.first.top3}/${race.first.starts}${race.second ? ` · ${race.second.no} ${cleanHorse(race.second.name)} ${race.second.top3}/${race.second.starts}` : ' · diğerlerinde ilk üç yok'}`
  : `${race.raceNo}. koşu: Ayırıcı geçmiş form kaydı yok (${race.comparableRunners}/${race.activeRunners} at incelendi)`)
const caption = `${city.toLocaleUpperCase('tr-TR')} | ${dateLabel(facts.date)} · geçmiş form karşılaştırması\nSon altı görünür sonuçta ilk üç bitiriş sayısı (${facts.comparableRaces}/${facts.totalRaces} koşuda karşılaştırma):\n${lines.join('\n')}\n\nKartlarda geçmiş ilk üç oranı ortancası, karşılaştırma kapsamı ve eşitlikler var. Yetersiz kayıtlı koşular işaretli. Bu model sırası veya gelecek sonuç tahmini değildir. Kaynak: TJK · Program kontrolü ${sourceTime} TSİ.\n\n#GanyanZekası #AtYarışı #YurtDışıYarışları`
if (caption.length > 2200) throw Error(`Caption too long: ${caption.length}`)
await writeFile(resolve(outputDirectory, 'caption.txt'), caption, 'utf8')
await writeFile(resolve(outputDirectory, 'facts.json'), JSON.stringify(facts, null, 2), 'utf8')
console.log(JSON.stringify({ outputDirectory, city, raceCount: facts.totalRaces, slideCount: totalPages, captionLength: caption.length }))
