import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { buildCityFacts } from './facts.mjs'
import { buildCityModelFacts } from './model-facts.mjs'
import { loadRankingModel, loadForeignRankingModel } from '../ranking.mjs'
import { racingCountry } from '../foreign-data.mjs'

const [programPath, city, outputDirectory] = process.argv.slice(2)
if (!programPath || !city || !outputDirectory) throw Error('Usage: node render.mjs PROGRAM_JSON CITY OUTPUT_DIRECTORY')
const program = JSON.parse(await readFile(programPath, 'utf8'))
const facts = buildCityFacts(program, city)
if (!facts) throw Error('No current, pre-start official program for this city')
const country = racingCountry(city)
const activeModel = country ? loadForeignRankingModel(country, { metadataOnly: true }) : loadRankingModel({ metadataOnly: true })
const model = buildCityModelFacts(program, city, activeModel?.metadata)
if (!model || model.rankedRaces !== facts.totalRaces) throw Error('Every race needs a verified active model ranking')
await mkdir(outputDirectory, { recursive: true })

const { chromium } = await import('file:///D:/Apps/HorseRide/.migration/ui-audit-tools/node_modules/playwright/index.mjs')
const browser = await chromium.launch({ executablePath: process.env.HORSERIDE_CHROMIUM_EXE || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true,args:['--disable-gpu','--use-angle=swiftshader','--enable-unsafe-swiftshader'] })
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
const dateLabel = day => day.split('-').reverse().join('.')
const shortDate = day => day?.split('-').reverse().slice(0, 2).join('.') ?? ''
const cleanHorse = name => {
  const words = String(name ?? '').replace(/\s+\((?:USA|GB|IRE|FR|GER|AUS|NZ|SAF|JPN|CAN|ARG|BRZ|CHI)\)(?=\s|$)/gi, '').trim().split(/\s+/)
  const gear = new Set(['KG', 'K', 'DB', 'SK', 'SKG', 'GKR', 'ÖG', 'TG', 'YP', 'BB', 'DS', 'AP', 'HKG', 'M'])
  while (words.length > 1 && gear.has(words.at(-1))) words.pop()
  return words.join(' ')
}
const pageSize = model.country === 'US' ? 3 : 5
const totalPages = Math.ceil(facts.races.length / pageSize)
const comparableModelRaces = model?.races.filter(race => race.ranked && race.archiveLeader) ?? []
const archiveModelDifferences = comparableModelRaces.filter(race => race.archiveDisagrees).length
const recentFormLabel = value => {
  if (!value) return ''
  const positions = String(value).match(/[0-9]/g)?.slice(-6).map(Number) ?? []
  if (!positions.length) return ''
  const topThree = positions.filter(position => position >= 1 && position <= 3).length
  return `Son sonuçlar: ${esc(value)} · ilk üç ${topThree}/${positions.length}`
}
const modelRow = race => {
  const startLabel = race.scheduledDate !== facts.date ? `${race.start} (${shortDate(race.scheduledDate)})` : race.start
  const last = race.lastRun
    ? `Son koşu: ${esc(shortDate(race.lastRun.date))} · ${esc(race.lastRun.city)} ${race.lastRun.distance ?? '—'} m ${esc(race.lastRun.surface)} pistte ${race.lastRun.finishPosition}.`
    : recentFormLabel(race.recentForm)
  const workout = model.country === 'US' && race.recentWorkout
    ? `<div class="model-signal">İdman: ${esc(shortDate(race.recentWorkout.date))} · ${race.recentWorkout.distanceMeters} m / ${race.recentWorkout.timeSeconds.toFixed(2).replace('.', ',')} sn${race.recentWorkout.groupRank ? ` · grup ${esc(race.recentWorkout.groupRank)}` : ''}</div>`
    : ''
  const archive = race.archiveDisagrees
    ? `<div class="archive-difference">Geçmiş derece lideri: ${esc(cleanHorse(race.archiveLeader))} · kayıt ${race.archiveCoverage}/${race.activeRunners} at</div>`
    : ''
  return `<article class="model-card"><div class="race-head"><strong>${race.raceNo}. KOŞU</strong><span>${esc(startLabel)} · ${race.distance} m ${esc(race.surface)}</span></div><div class="model-name"><span>1</span>${esc(cleanHorse(race.first.name))}<small>At no ${race.first.no}</small></div><div class="model-second">2 · ${esc(cleanHorse(race.second.name))} <small>At no ${race.second.no}</small></div>${last ? `<div class="model-signal">${last}</div>` : ''}${workout}${archive}</article>`
}
const sourceTime = new Date(facts.fetchedAt).toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' })
const logo = (await readFile('D:/Apps/HorseRide/public/brand/ganyan-icon.png')).toString('base64')

const style = `<style>
*{box-sizing:border-box}html,body{margin:0;width:1080px;height:1350px}body{font-family:Arial,sans-serif;background:#071b23;color:#f6f4e9;padding:59px 63px;overflow:hidden;position:relative}
body:before{content:"";position:absolute;right:-310px;top:-420px;width:950px;height:950px;border-radius:50%;background:radial-gradient(circle,#1a706358,transparent 68%);pointer-events:none}
header{display:flex;align-items:center;gap:19px;color:#a7ebca;font-size:23px;font-weight:bold;letter-spacing:2.4px;position:relative}header img{width:68px;height:68px;border-radius:50%}header small{margin-left:auto;font-size:18px;letter-spacing:1.5px}
.date{margin-top:37px;color:#dec381;font-size:25px;letter-spacing:2px;text-transform:uppercase}.bar{height:3px;background:linear-gradient(90deg,#9ce4c0,#d5b877,transparent);margin:17px 0 22px}
h1{font-size:79px;line-height:1.02;margin:14px 0 19px;letter-spacing:-2px}h2{font-size:43px;line-height:1.1;margin:13px 0 0}.accent{color:#a7ebca}.dek{font-size:29px;line-height:1.34;color:#d2dfda;margin:0;max-width:940px}
h2.long-title{font-size:35px}
.cover-track{position:relative;margin:58px auto 43px;width:840px;height:360px;border:23px solid #d4bb7e;border-radius:50%;box-shadow:0 0 0 13px #12343a,0 0 0 16px #4c7567;transform:rotate(-9deg)}.cover-track:before{content:"";position:absolute;inset:35px;border:3px dashed #79bca8;border-radius:50%}.track-center{position:absolute;inset:75px 110px;display:flex;flex-direction:column;align-items:center;justify-content:center;transform:rotate(9deg)}.track-center strong{font-size:90px;line-height:1;color:#a7ebca}.track-center span{font-size:26px;color:#e5d3a6;letter-spacing:2px}.track-dot{position:absolute;width:27px;height:27px;background:#9ee9c5;border-radius:50%;box-shadow:0 0 0 8px #225c54}.track-dot.one{left:40px;top:58px}.track-dot.two{right:50px;top:48px}.track-dot.three{left:395px;bottom:-31px}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.stat{padding:24px 21px;border:1px solid #3e6b60;border-radius:18px;background:#113138}.stat strong{display:block;color:#a7ebca;font-size:49px;line-height:1}.stat span{display:block;font-size:19px;line-height:1.2;margin-top:10px;color:#d5e2dd}
.compare{margin-top:20px;padding:17px 22px;border-left:5px solid #d4bb7e;background:#102c32;border-radius:6px 14px 14px 6px;color:#e9ddbb;font-size:23px}.compare strong{color:#a7ebca}
.grid{display:grid;gap:11px}.history-card,.model-card{padding:13px 19px;border:1px solid #345b59;border-radius:17px;background:#122b31}.history-card{min-height:151px}.race-head{display:flex;justify-content:space-between;align-items:center;color:#e2c786;font-size:24px}.race-head span{font-size:20px;color:#afc7c3}.history-name{font-weight:700;font-size:29px;margin-top:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.history-time{font-size:25px;color:#a7ebca;margin-top:1px}.history-time span{font-size:19px;color:#c2d2cd}.empty{font-size:24px;color:#d5d2bc;margin-top:20px}.coverage{font-size:18px;color:#a9bfbb;margin-top:5px}
.model-card{min-height:154px}.model-name{display:flex;align-items:baseline;gap:9px;font-size:29px;font-weight:700;color:#a7ebca;margin-top:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.model-name span{font-size:20px;color:#071b23;background:#a7ebca;border-radius:50%;width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;flex:none}.model-name small{font-size:16px;font-weight:normal;color:#c4d6cf;margin-left:auto;flex:none}.model-second{font-size:22px;color:#ecdfbd;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.model-second small{font-size:16px;color:#b7c9c2}.model-signal,.archive-difference{font-size:17px;color:#d0dcd6;margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.archive-difference{color:#e3c582}
.note{position:absolute;left:63px;right:63px;bottom:105px;font-size:21px;line-height:1.32;color:#b6c7c3}footer{position:absolute;left:63px;right:63px;bottom:52px;display:flex;justify-content:space-between;color:#a7ebca;font-size:22px}
</style>`
const renderStyle = model.country === 'US'
  ? style.replace('</style>', '.model-card{min-height:229px;padding:20px 23px}.model-name{font-size:33px}.model-second{font-size:25px}.model-signal{font-size:19px}</style>')
  : style
const dateLine = `<div class="date">${esc(city)} · ${esc(dateLabel(facts.date))}</div>`
const historic = facts.races.filter(race => race.historicalFastest).length
const workouts = facts.races.filter(race => race.workout).length
const pages = Array.from({ length: totalPages }, (_, index) => {
  const from = index * pageSize
  const to = Math.min(from + pageSize, model.races.length)
  const note = model.country === 'US'
    ? 'Model ilk iki sırası. Son sonuç dizisi TJK, varsa idman Equibase kaydıdır. İdman farklı pistte yapılmış olabilir.'
    : index === 0 ? 'Modelin her koşudaki ilk iki atı ve ilk atın son kayıtlı koşusu. Sıralama kesin sonuç değildir.'
      : 'Geçmiş derece lideri ayrı bir arşiv verisidir.'
  return `${dateLine}<h2 class="${city.length > 22 ? 'long-title' : ''}">${esc(city)} · Koşu ${from + 1}–${to}</h2><div class="bar"></div><div class="grid">${model.races.slice(from, to).map(modelRow).join('')}</div><div class="note">${note} Program: ${esc(sourceTime)} TSİ · Kaynak: TJK.</div>`
})

try {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 })
  for (let index = 0; index < pages.length; index++) {
    await page.setContent(`<meta charset="utf-8">${renderStyle}<header><img src="data:image/png;base64,${logo}"> GANYAN ZEKÂSI <small>YARIŞ DOSYASI</small></header>${pages[index]}<footer><span>@ganyan_zekasi</span><span>${index + 1}/${totalPages}</span></footer>`)
    await page.evaluate(() => document.fonts.ready)
    const overflow = await page.evaluate(() => {
      const grid = document.querySelector('.grid')
      const last = grid?.lastElementChild
      return last && last.getBoundingClientRect().bottom > document.querySelector('.note').getBoundingClientRect().top - 12
    })
    if (overflow) throw Error(`Slide ${index + 1} layout overflow`)
    await page.screenshot({ path: resolve(outputDirectory, `slide-${index + 1}.jpg`), type: 'jpeg', quality: 94 })
  }
} finally { await browser.close() }

const modelLines = model.races.map(race => `${race.raceNo}. koşu: ${race.first.no} ${cleanHorse(race.first.name)} / ${race.second.no} ${cleanHorse(race.second.name)}`)
const detail = model.country === 'US'
  ? `Kartlarda ilk sıradaki atın TJK son sonuçları ve varsa tarihli Equibase idmanı bulunur. Son eğitim verisi: ${dateLabel(model.trainedThrough)}.`
  : `Kartlarda ilk atın son kayıtlı koşusu ve farklıysa aynı pist/mesafedeki geçmiş derece lideri var. ${comparableModelRaces.length ? `Model ile arşiv lideri ${archiveModelDifferences}/${comparableModelRaces.length} koşuda ayrılıyor.` : ''}`
const caption = `${city.toLocaleUpperCase('tr-TR')} | ${dateLabel(facts.date)} · ${facts.totalRaces} koşu\nModel ilk iki sırası (at numarası ve adı):\n${modelLines.join('\n')}\n\n${detail} Kaynak: TJK · Program kontrolü ${sourceTime} TSİ.\n\nSıralama kesin sonuç veya olasılık hesabı değildir.\n\n#GanyanZekası #AtYarışı #${city.toLocaleLowerCase('tr-TR').replace(/[^a-z0-9ığüşöç]/g, '')}yarislari`
if (caption.length > 2200) throw Error(`Caption too long: ${caption.length}`)
await writeFile(resolve(outputDirectory, 'caption.txt'), caption, 'utf8')
await writeFile(resolve(outputDirectory, 'facts.json'), JSON.stringify({ facts, model }, null, 2), 'utf8')
console.log(JSON.stringify({ outputDirectory, city, date: facts.date, raceCount: facts.totalRaces, timed: historic, workouts, modelRaces: model?.rankedRaces ?? 0, slideCount: pages.length, captionLength: caption.length }))
