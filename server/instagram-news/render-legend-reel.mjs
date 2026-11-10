import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const exec = promisify(execFile)
const root = process.argv[2] ? resolve(process.argv[2]) : resolve('work/instagram-news/reel-bold-pilot')
const art = await readFile(resolve(root, 'background.png'))
await mkdir(resolve(root, 'frames'), { recursive: true })
const { chromium } = await import('file:///D:/Apps/HorseRide/.migration/ui-audit-tools/node_modules/playwright/index.mjs')
const browser = await chromium.launch({ executablePath:process.env.HORSERIDE_CHROMIUM_EXE || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true,args:['--disable-gpu','--use-angle=swiftshader','--enable-unsafe-swiftshader'] })
try {
  const page = await browser.newPage({ viewport:{width:1080,height:1920}, deviceScaleFactor:1 })
  await page.setContent(`<meta charset="utf-8"><style>html,body{margin:0;width:1080px;height:1920px;background:#071722}canvas{display:block}</style><canvas id="screen" width="1080" height="1920"></canvas><img id="art" style="display:none" src="data:image/png;base64,${art.toString('base64')}"><script>
  window.ready=false;const image=document.getElementById('art');image.onload=()=>window.ready=true;
  const canvas=document.getElementById('screen'),ctx=canvas.getContext('2d');
  function text(value,x,y,size,color,weight=700){ctx.font=weight+' '+size+'px Arial';ctx.fillStyle=color;ctx.fillText(value,x,y)}
  window.draw=(t)=>{
    const W=1080,H=1920,zoom=1+0.036*(t/20),sw=864/zoom,sh=1536/zoom;
    const sx=Math.max(0,Math.min(image.width-sw,(image.width-sw)/2+22*Math.sin(t*.27))),sy=Math.max(0,Math.min(image.height-sh,(image.height-sh)/2+8*Math.sin(t*.18)));
    ctx.clearRect(0,0,W,H);ctx.drawImage(image,sx,sy,sw,sh,0,0,W,H);
    let shade=ctx.createLinearGradient(0,0,0,1080);shade.addColorStop(0,'rgba(2,15,24,.78)');shade.addColorStop(.48,'rgba(2,15,24,.36)');shade.addColorStop(1,'rgba(2,15,24,0)');ctx.fillStyle=shade;ctx.fillRect(0,0,W,1080);
    shade=ctx.createLinearGradient(0,1280,0,H);shade.addColorStop(0,'rgba(2,15,24,0)');shade.addColorStop(1,'rgba(2,15,24,.88)');ctx.fillStyle=shade;ctx.fillRect(0,1280,W,640);
    for(let i=0;i<45;i++){const px=(i*173.21+t*(10+i%7*4))%1180-50,py=1120+(i*97.7)%520+25*Math.sin(t*1.5+i);ctx.beginPath();ctx.arc(px,py,1.5+(i%4)*.6,0,Math.PI*2);ctx.fillStyle='rgba(242,207,140,'+(0.07+0.09*(1+Math.sin(t*2+i))/2)+')';ctx.fill()}
    ctx.fillStyle='rgba(13,46,48,.88)';ctx.fillRect(58,61,374,60);text('GANYAN ZEKÂSI',79,103,28,'#a8ebc9');
    const scene=Math.min(3,Math.floor(t/5)),local=t-scene*5,alpha=Math.max(0,Math.min(1,local/.75,(5-local)/.75));
    ctx.save();ctx.globalAlpha=alpha;const lift=22*(1-alpha);
    if(scene===0){text('TARİHTEN BİR KOŞU',68,255+lift,36,'#e5cb91');text('1996 GAZİ',68,357+lift,80,'#f9f5e7');text('KOŞUSU',68,449+lift,80,'#f9f5e7')}
    if(scene===1){text('23 HAZİRAN 1996',68,273+lift,53,'#e5cb91');text('İSTANBUL',68,379+lift,75,'#f9f5e7');text('2400 M · ÇİM',68,465+lift,56,'#a8ebc9')}
    if(scene===2){text('BOLD PILOT',68,305+lift,80,'#f9f5e7');text('JOKEY',68,392+lift,38,'#e5cb91');text('HALİS KARATAŞ',68,470+lift,56,'#a8ebc9')}
    if(scene===3){text('RESMÎ BİTİRİŞ',68,271+lift,43,'#e5cb91');text('2:26,22',68,405+lift,120,'#f9f5e7');text('TJK · 23.06.1996',68,470+lift,38,'#a8ebc9')}
    ctx.restore();
    text('TEMSİLÎ CANLANDIRMA · GERÇEK YARIŞ GÖRÜNTÜSÜ DEĞİLDİR',68,1780,26,'#f4eedf');
    ctx.fillStyle='rgba(168,235,201,.32)';ctx.fillRect(68,1834,944,5);ctx.fillStyle='#a8ebc9';ctx.fillRect(68,1834,944*t/20,5);
    ctx.beginPath();ctx.arc(68+944*t/20,1836,11,0,Math.PI*2);ctx.fillStyle='#e5cb91';ctx.fill();
  }
  </script>`)
  await page.waitForFunction(() => window.ready)
  for(let frame=0;frame<240;frame++){
    await page.evaluate(t=>window.draw(t),frame/12)
    await page.screenshot({path:resolve(root,'frames',`frame-${String(frame).padStart(4,'0')}.jpg`),type:'jpeg',quality:83})
  }
} finally { await browser.close() }
const python='D:/Apps/HorseRide/.venv/Scripts/python.exe'
const ffmpeg=(await exec(python,['-c','import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'],{windowsHide:true})).stdout.trim()
await exec(ffmpeg,['-y','-framerate','12','-i',resolve(root,'frames/frame-%04d.jpg'),'-vf','fps=30,format=yuv420p','-t','20','-c:v','libx264','-preset','medium','-crf','22','-pix_fmt','yuv420p','-an','-movflags','+faststart',resolve(root,'reel.mp4')],{windowsHide:true,timeout:180000,maxBuffer:50000})
await writeFile(resolve(root,'caption.txt'),`Bir yarışın hafızası: 23 Haziran 1996 Gazi Koşusu.\n\nTJK resmî sonuç kaydına göre Bold Pilot, Halis Karataş ile İstanbul'daki 2400 metre çim koşuyu 2.26.22'lik dereceyle kazandı.\n\nBu video AI destekli özgün bir illüstrasyondan hazırlanmış temsili canlandırmadır. Gerçek yarış görüntüsü değildir; atın o günkü görünüşünü, formalarını veya yarış içindeki pozisyonları birebir göstermez. Ses ve müzik kullanılmamıştır.\n\nKaynak: Türkiye Jokey Kulübü, 1996 Gazi Koşusu tarihli sonuç listesi: https://www.tjk.org/TR/YarisSever/Query/Page/TumOnemliKosular?QueryParameter_OnemliKosuKodu=110\n\n#GanyanZekası #GaziKoşusu #BoldPilot #AtYarışı`, 'utf8')
console.log(JSON.stringify({file:resolve(root,'reel.mp4'),frames:240,durationSeconds:20,source:'TJK official 1996 Gazi result',silent:true}))
