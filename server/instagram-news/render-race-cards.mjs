import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { buildRaceCardFacts } from './race-card-facts.mjs'
import { meetingHighlight } from './meeting-highlight.mjs'
import { loadRankingModel, loadForeignRankingModel } from '../ranking.mjs'
import { racingCountry } from '../foreign-data.mjs'

const [programPath, city, outputDirectory, startText = '0', endText = '10'] = process.argv.slice(2)
if (!programPath || !city || !outputDirectory) throw Error('Usage: node render-race-cards.mjs PROGRAM CITY DIRECTORY [START] [END]')
const program = JSON.parse(await readFile(programPath, 'utf8'))
const country = racingCountry(city) ?? 'TR'
const metadata = (country === 'TR' ? loadRankingModel({ metadataOnly: true }) : loadForeignRankingModel(country, { metadataOnly: true }))?.metadata
const facts = buildRaceCardFacts(program, city, metadata)
if (!facts) throw Error('A current pre-start program and complete active model ranking are required')
const start = Number(startText), end = Math.min(Number(endText), facts.races.length)
if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end - start > 10) throw Error('Race card range must contain 1–10 races')
const races = facts.races.slice(start, end)
const scopeLabel=program.publicationScope==='remaining'?'KALAN KOŞULAR':'KOŞU DOSYASI'
await mkdir(outputDirectory, { recursive: true })

const { chromium } = await import('file:///D:/Apps/HorseRide/.migration/ui-audit-tools/node_modules/playwright/index.mjs')
const browser = await chromium.launch({ executablePath: process.env.HORSERIDE_CHROMIUM_EXE || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true,args:['--disable-gpu','--use-angle=swiftshader','--enable-unsafe-swiftshader'] })
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
const dateLabel = day => day.split('-').reverse().join('.')
const sourceTime = new Date(facts.fetchedAt).toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' })
const logo = (await readFile('D:/Apps/HorseRide/public/brand/ganyan-icon.png')).toString('base64')
const sourceLabel = country === 'US' ? 'TJK programı ve sonuçları · varsa Equibase idmanı' : 'TJK programı, sonuçları ve idman kayıtları'
const noteFor = horse => {
  const notes = [horse.lastRun, horse.workout, horse.form === 'Sonuç dizisi kaydı yok.' ? null : horse.form].filter(Boolean)
  return notes.slice(0, 2)
}
const style = `<style>
*{box-sizing:border-box}html,body{margin:0;width:1080px;height:1350px}body{font-family:Arial,sans-serif;background:#061921;color:#f5f5eb;overflow:hidden;position:relative;padding:48px 62px}
body:before{content:'';position:absolute;right:-200px;top:-270px;width:750px;height:750px;border-radius:50%;background:radial-gradient(circle,#1a6f6566,transparent 70%)}
.top{display:flex;align-items:center;gap:18px;color:#a7ecc7;font-size:22px;letter-spacing:2.5px;font-weight:700}.top img{width:64px;height:64px;border-radius:50%}.top .series{margin-left:auto;font-size:17px;color:#ddc88e;letter-spacing:1px}
.eyebrow{font-size:23px;letter-spacing:2px;color:#d8be83;margin-top:34px;text-transform:uppercase}.city{font-size:64px;line-height:1.05;letter-spacing:-1.7px;margin:9px 0 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.city.long{font-size:48px}
.race{display:flex;align-items:baseline;gap:22px;margin-top:24px;padding-bottom:21px;border-bottom:3px solid #bbdda2}.race strong{font-size:75px;line-height:1;color:#a8ecc9}.race span{font-size:25px;color:#e9deb7}
.lede{font-size:22px;color:#d5e2db;margin:20px 0 14px;line-height:1.28;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cards{display:grid;gap:12px}.card{height:165px;border:1px solid #3c6661;background:#102d34;border-radius:20px;padding:15px 20px;display:flex;gap:18px;position:relative}.card:first-child{background:#17453f;border-color:#8dd3ae}
.rank{font-size:40px;font-weight:700;color:#071d23;background:#a7ecc7;border-radius:50%;width:58px;height:58px;flex:none;text-align:center;line-height:58px}.card:not(:first-child) .rank{background:#d5c28f}.body{min-width:0;flex:1}.name{font-size:29px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.12}.number{font-size:17px;color:#bed2ca;margin-top:3px}.fact{font-size:17px;color:#d8e4de;line-height:1.2;margin-top:6px;max-height:41px;overflow:hidden}.fact + .fact{margin-top:2px;color:#d7c693}
.nothing{font-size:19px;color:#d2d9d1;margin-top:12px}.explain{position:absolute;left:62px;right:62px;bottom:101px;font-size:19px;line-height:1.33;color:#bfd2c8}.explain b{color:#d7c693}.footer{position:absolute;left:62px;right:62px;bottom:43px;border-top:1px solid #436b65;padding-top:13px;display:flex;justify-content:space-between;color:#a7ecc7;font-size:19px}
</style>`

try {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 })
  for (let index = 0; index < races.length; index++) {
    const race = races[index]
    const raceDate = race.scheduledDate !== facts.date ? ` · ${dateLabel(race.scheduledDate)}` : ''
    const cards = race.horses.map(horse => {
      const notes = noteFor(horse)
      return `<article class="card"><div class="rank">${horse.rank}</div><div class="body"><div class="name">${esc(horse.name)}</div><div class="number">At no ${horse.no} · Model sırası ${horse.rank}</div>${notes.length ? notes.map(note => `<div class="fact">${esc(note)}</div>`).join('') : '<div class="nothing">Önceki yarış veya idman kaydı sınırlı.</div>'}</div></article>`
    }).join('')
    const lead = race.leadSignal ? `İlk iki arasındaki model puanı farkında öne çıkan girdi: ${race.leadSignal}` : `Modelin ilk ${race.horses.length} sırası · Her at için kısa veri yorumu`
    const html = `<meta charset="utf-8">${style}<div class="top"><img src="data:image/png;base64,${logo}">GANYAN ZEKÂSI <span class="series">${scopeLabel}</span></div><div class="eyebrow">${dateLabel(facts.date)} · ${esc(city.toLocaleUpperCase('tr-TR'))}</div><h1 class="city ${city.length > 20 ? 'long' : ''}">${esc(city)}</h1><div class="race"><strong>${race.raceNo}. KOŞU</strong><span>${esc(race.start)}${raceDate} · ${race.distance} m · ${esc(race.surface)}</span></div><div class="lede">${esc(lead)}</div><div class="cards">${cards}</div><div class="explain"><b>Nasıl okunur?</b> Sıra model puanına dayanır; notlar hedef yarıştan önceki doğrulanmış kayıtlardır. İdmanlar farklı koşullarda yapılmış olabilir. Kesin sonuç değildir.<br>${esc(sourceLabel)} · Program ${sourceTime} TSİ · Model verisi ${dateLabel(facts.trainedThrough)} tarihine kadar.</div><div class="footer"><span>@ganyan_zekasi</span><span>${start + index + 1}/${facts.totalRaces}</span></div>`
    await page.setContent(html)
    await page.evaluate(() => document.fonts.ready)
    const overflow = await page.evaluate(() => document.querySelector('.cards').getBoundingClientRect().bottom > document.querySelector('.explain').getBoundingClientRect().top - 13)
    if (overflow) throw Error(`Race ${race.raceNo} slide layout overflow`)
    await page.screenshot({ path: resolve(outputDirectory, `slide-${index + 1}.jpg`), type: 'jpeg', quality: 93 })
  }
} finally { await browser.close() }

const highlight = meetingHighlight({ ...facts, races })
const caption = `${city.toLocaleUpperCase('tr-TR')} | ${dateLabel(facts.date)} · ${program.publicationScope==="remaining"?"KALAN ":""}${facts.totalRaces} koşu\nHer görsel bir koşu: etkin modelin ilk dört sırası ve atların önceki yarış/idman kayıtlarından kısa veri yorumu.${highlight ? `\n\n${highlight}` : ''}\n\n${races.map(race => `${race.raceNo}. koşu (${race.start}): ${race.horses.map(horse => `${horse.rank}) ${horse.no} ${horse.name}`).join(' · ')}`).join('\n')}\n\nKaynak: ${sourceLabel}. Program ${sourceTime} TSİ. Etkin modelin son eğitim verisi ${dateLabel(facts.trainedThrough)}. Yeni adaylar günlük eğitilir; test eşiğini geçmeden etkin model değişmez. Sıralama kesin sonuç veya kazanma olasılığı değildir.\n\n#GanyanZekası #AtYarışı #YarışAnalizi`
if (caption.length > 2200) throw Error(`Caption too long: ${caption.length}`)
await writeFile(resolve(outputDirectory, 'caption.txt'), caption, 'utf8')
await writeFile(resolve(outputDirectory, 'facts.json'), JSON.stringify({ ...facts, races }, null, 2), 'utf8')
console.log(JSON.stringify({ outputDirectory, city, date: facts.date, raceCount: races.length, modelRaces: facts.totalRaces, slideCount: races.length, captionLength: caption.length, start, end }))
