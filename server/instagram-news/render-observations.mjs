import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { buildCityObservations } from './observations.mjs'
import { formatSeconds } from './facts.mjs'

const [programPath, evidencePath, city, directory] = process.argv.slice(2)
if (!programPath || !evidencePath || !city || !directory) throw Error('Usage: node render-observations.mjs PROGRAM_JSON JOCKEY_JSON CITY DIRECTORY')
const [program, jockeyFile] = await Promise.all([programPath, evidencePath].map(async path => JSON.parse(await readFile(path, 'utf8'))))
const report = buildCityObservations(program, city, jockeyFile)
if (!report || report.races.length > 10 || report.races.filter(race => race.workout).length < 4) throw Error('Insufficient current observation data')
await mkdir(directory, { recursive: true })
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const cleanHorse = name => {
  const words = String(name ?? '').trim().split(/\s+/)
  const gear = new Set(['KG','K','DB','SK','SKG','GKR','ÖG','TG','YP','BB','DS','AP','HKG','M'])
  while (words.length > 1 && gear.has(words.at(-1))) words.pop()
  return words.join(' ')
}
const dateShort = date => date?.split('-').reverse().slice(0,2).join('.') ?? ''
const number = value => (100 * value).toLocaleString('tr-TR', { maximumFractionDigits: 1 })
const logo = (await readFile('D:/Apps/HorseRide/public/brand/ganyan-icon.png')).toString('base64')
const style = `<style>*{box-sizing:border-box}html,body{margin:0;width:1080px;height:1350px}body{font-family:Arial,sans-serif;background:#081a24;color:#f8f4e9;padding:60px 64px;overflow:hidden}body:before{content:"";position:absolute;right:-260px;top:-340px;width:850px;height:850px;border-radius:50%;background:radial-gradient(circle,#21635466,transparent 70%)}header{display:flex;align-items:center;gap:20px;font-size:24px;letter-spacing:2px;color:#9ce6c5;font-weight:bold}header img{width:72px;height:72px;border-radius:50%}header small{margin-left:auto;font-size:19px}.date{font-size:27px;color:#e3c07b;letter-spacing:2px;margin-top:39px}.bar{height:3px;background:linear-gradient(90deg,#e3c07b,#9ce6c5,transparent);margin:18px 0 17px}h1{font-size:70px;line-height:1.02;margin:17px 0 23px}h2{font-size:43px;line-height:1.1;margin:17px 0}.lead{font-size:30px;line-height:1.4;color:#c8d8d1}.track{position:relative;margin-top:55px;height:440px;border:33px solid #d7bb78;border-radius:50%;transform:rotate(-9deg);box-shadow:0 0 0 23px #12343a,0 0 0 26px #427068;display:flex;align-items:center;justify-content:center}.track:before{content:"";position:absolute;inset:34px;border:3px dashed #8edab7;border-radius:50%}.track-inner{transform:rotate(9deg);font-size:65px;color:#a0e6c3;font-weight:700;text-align:center;line-height:1.05}.track-inner span{font-size:26px;color:#e6d5a8}.grid{display:grid;gap:12px}.card{border:1px solid #40635f;background:#112c33;border-radius:18px;padding:16px 20px;min-height:206px}.race{display:flex;justify-content:space-between;font-size:25px;color:#e2c386}.race span{font-size:21px;color:#b9cfca}.fact{display:flex;gap:14px;align-items:baseline;margin-top:13px;font-size:25px}.fact b{font-size:23px;color:#a0e6c3;min-width:100px}.fact strong{font-size:27px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:500px}.fact em{font-style:normal;font-size:20px;color:#c8d7d0;margin-left:auto;white-space:nowrap}.none{color:#adbfba;font-size:22px}.note{position:absolute;left:64px;right:64px;bottom:108px;color:#b4c7c1;font-size:21px;line-height:1.35}footer{position:absolute;left:64px;right:64px;bottom:52px;color:#a0e6c3;font-size:23px;display:flex;justify-content:space-between}</style>`
const row = race => `<div class="card"><div class="race"><strong>${race.raceNo}. KOŞU</strong><span>${escape(race.start)} · ${race.distance} m · ${escape(race.surface)}</span></div><div class="fact"><b>İDMAN</b>${race.workout ? `<strong>${escape(cleanHorse(race.workout.horseName))}</strong><em>${race.workout.splitDistance} m · ${escape(formatSeconds(race.workout.timeSeconds))} · ${race.workout.coveredRunners}/${race.activeRunners}</em>` : '<span class="none">Karşılaştırılabilir kayıt yok</span>'}</div><div class="fact"><b>JOKEY</b>${race.jockeyArchive ? `<strong>${escape(race.jockeyArchive.jockey)}</strong><em>${race.jockeyArchive.wins}/${race.jockeyArchive.starts} · %${number(race.jockeyArchive.rate)}</em>` : '<span class="none">Yeterli arşiv örneği yok</span>'}</div></div>`
const pages = [
  `<div class="date">${escape(city)} · ${escape(dateShort(report.date))}.2026</div><h1>İdman defteri.<br>Jokey arşivi.</h1><div class="bar"></div><div class="lead">Aynı yarış için iki ayrı geçmiş kayıt. Kısa idman süresi ve jokeyin geçmiş kazanma oranı, bugünün sonucunu göstermez.</div><div class="track"><div class="track-inner">${report.races.length} KOŞU<br><span>KAYNAKLI ARŞİV TARAMASI</span></div></div><div class="note">İdman: son 45 gün · Aynı hipodrom, pist türü ve ara mesafe.<br>Jokey: son 90 gün · Aynı hipodrom · En az 20 start.</div>`,
  `<div class="date">${escape(city)} · ${escape(dateShort(report.date))}.2026</div><h2>1–${Math.min(4,report.races.length)}. koşu · geçmiş gözlemler</h2><div class="bar"></div><div class="grid">${report.races.slice(0,4).map(row).join('')}</div><div class="note">İdman adı kısa süreli son galop kaydını; jokey satırı ayrı bir arşiv istatistiğini gösterir.</div>`,
  `<div class="date">${escape(city)} · ${escape(dateShort(report.date))}.2026</div><h2>${Math.min(5,report.races.length)}–${report.races.length}. koşu · geçmiş gözlemler</h2><div class="bar"></div><div class="grid">${report.races.slice(4).map(row).join('')}</div><div class="note">Örnek sayıları ve tarih aralığı açıklamada. Eksik kayıtlar tamamlanmış gibi gösterilmez.</div>`,
]
const { chromium } = await import('file:///D:/Apps/HorseRide/.migration/ui-audit-tools/node_modules/playwright/index.mjs')
const browser = await chromium.launch({ executablePath: process.env.HORSERIDE_CHROMIUM_EXE || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true,args:['--disable-gpu','--use-angle=swiftshader','--enable-unsafe-swiftshader'] })
try {
  const page = await browser.newPage({ viewport: { width:1080, height:1350 }, deviceScaleFactor:1 })
  for (let i=0;i<pages.length;i++) {
    await page.setContent(`<meta charset="utf-8">${style}<header><img src="data:image/png;base64,${logo}">GANYAN ZEKÂSI<small>ARŞİV DOSYASI</small></header>${pages[i]}<footer><span>@ganyan_zekasi</span><span>${i+1}/3</span></footer>`)
    await page.evaluate(() => document.fonts.ready)
    const overflow = await page.evaluate(() => { const last=document.querySelector('.card:last-child');return last && last.getBoundingClientRect().bottom > document.querySelector('.note').getBoundingClientRect().top-12 })
    if (overflow) throw Error('Slide layout overflow')
    await page.screenshot({ path:resolve(directory,`slide-${i+1}.jpg`), type:'jpeg', quality:94 })
  }
} finally { await browser.close() }
const lines = report.races.map(race => {
  const workout = race.workout ? `${cleanHorse(race.workout.horseName)}: ${race.workout.splitDistance} m ${formatSeconds(race.workout.timeSeconds)} (${race.workout.coveredRunners}/${race.activeRunners} kayıtlı at; ${dateShort(race.workout.workoutDate)})` : 'idman karşılaştırması yok'
  const jockey = race.jockeyArchive ? `${race.jockeyArchive.jockey}: ${race.jockeyArchive.wins}/${race.jockeyArchive.starts} (%${number(race.jockeyArchive.rate)}; ${race.jockeyArchive.coveredJockeys}/${race.jockeyArchive.activeRunners} jokey)` : 'yeterli jokey arşivi yok'
  return `${race.raceNo}. koşu — İdman: ${workout}. Jokey: ${jockey}.`
})
const caption = `${city} | ${dateShort(report.date)}.2026 · İdman ve jokey arşivi\n\n${lines.join('\n')}\n\nİdmanda her atın son 45 gündeki aynı hipodrom ve pist türü galopunun son kaydı kullanıldı; ara mesafe grubu en çok atı kapsayan 800/600/400 m arasından seçildi. Kısa süre, idmanın yükünü veya bugünkü yarış formunu tek başına göstermez.\n\nJokey satırında, o koşudaki jokeyler arasında son 90 günün doğrulanmış aynı hipodrom galibiyet oranı en yüksek olan gösterilir; en az 20 startı olanlar karşılaştırılır. Bu, tam kariyer verisi veya bugünkü at-jokey uyumunun ölçümü değildir. İki arşiv satırı birbirinden bağımsızdır ve sonuç öngörüsü değildir.\n\nKaynak: TJK programı, resmi idman kayıtları ve tarihli yarış sonuçları. Arşiv son günü: ${dateShort(jockeyFile.archiveThrough)}. Program kontrolü: ${new Date(report.fetchedAt).toLocaleTimeString('tr-TR',{timeZone:'Europe/Istanbul',hour:'2-digit',minute:'2-digit'})} TSİ.\n\n#GanyanZekası #AtYarışı #${city.toLocaleLowerCase('tr-TR').replace(/[^a-z0-9ığüşöç]/g,'')}yarislari`
if (caption.length > 2200) throw Error(`Caption too long: ${caption.length}`)
await writeFile(resolve(directory,'caption.txt'),caption,'utf8')
await writeFile(resolve(directory,'observations.json'),JSON.stringify(report,null,2),'utf8')
console.log(JSON.stringify({city,date:report.date,races:report.races.length,workouts:report.races.filter(r=>r.workout).length,jockeys:report.races.filter(r=>r.jockeyArchive).length,captionLength:caption.length}))
