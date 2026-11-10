import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {resolve} from 'node:path'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'

const exec=promisify(execFile)
const root=resolve(process.argv[2])
if(!root)throw Error('Render directory required')
const background=(await readFile(resolve(root,'gazi-1936-background.png'))).toString('base64')
const horse=(await readFile(resolve(root,'gazi-1936-horse.png'))).toString('base64')
const logo=(await readFile('D:/Apps/HorseRide/public/brand/ganyan-icon.png')).toString('base64')
await mkdir(resolve(root,'frames'),{recursive:true})
const {chromium}=await import('file:///D:/Apps/HorseRide/.migration/ui-audit-tools/node_modules/playwright/index.mjs')
const browser=await chromium.launch({executablePath:process.env.HORSERIDE_CHROMIUM_EXE || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
try{
 const page=await browser.newPage({viewport:{width:1080,height:1920},deviceScaleFactor:1})
 await page.setContent(`<meta charset="utf-8"><style>html,body{margin:0;width:1080px;height:1920px;background:#061a22}canvas{display:block}</style><canvas id="screen" width="1080" height="1920"></canvas><img id="bg" hidden src="data:image/png;base64,${background}"><img id="horse" hidden src="data:image/png;base64,${horse}"><img id="logo" hidden src="data:image/png;base64,${logo}"><script>
 const W=1080,H=1920,c=document.getElementById('screen'),ctx=c.getContext('2d');
 const bg=document.getElementById('bg'),horse=document.getElementById('horse'),logo=document.getElementById('logo');
 window.ready=Promise.all([bg,horse,logo].map(img=>img.decode())).then(()=>true);
 const ease=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=ease(x);return x*x*(3-2*x)};
 function label(value,x,y,size,color='#f8f0de',weight=700){
  ctx.font=weight+' '+size+'px Arial';ctx.fillStyle=color;ctx.shadowColor='rgba(1,15,23,.65)';ctx.shadowBlur=13;
  ctx.fillText(value,x,y);ctx.shadowBlur=0;
 }
 function frame(t){
  const scale=1.02+0.033*t/18,sw=W/scale,sh=H/scale,dx=(W-sw)/2+12*Math.sin(t*.23),dy=(H-sh)/2+5*Math.sin(t*.17);
  ctx.clearRect(0,0,W,H);ctx.drawImage(bg,0,0,bg.width,bg.height,-dx*scale,-dy*scale,W*scale,H*scale);
  let gradient=ctx.createLinearGradient(0,0,0,870);gradient.addColorStop(0,'rgba(2,16,25,.83)');gradient.addColorStop(.72,'rgba(2,16,25,.31)');gradient.addColorStop(1,'transparent');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,W,870);
  gradient=ctx.createLinearGradient(0,1480,0,H);gradient.addColorStop(0,'transparent');gradient.addColorStop(1,'rgba(2,16,25,.92)');
  ctx.fillStyle=gradient;ctx.fillRect(0,1480,W,440);
  // A hand-drawn film grain and moving dust line keep the scene in motion.
  for(let i=0;i<64;i++){
   const x=(i*191.37+t*(24+i%6*7))%1220-60,y=1270+(i*79.1)%370+9*Math.sin(t*3+i);
   ctx.beginPath();ctx.arc(x,y,1.2+(i%4)*.65,0,Math.PI*2);
   ctx.fillStyle='rgba(239,196,124,'+(0.035+0.035*(1+Math.sin(t*4+i))/2)+')';ctx.fill();
  }
  ctx.drawImage(logo,66,65,58,58);label('GANYAN ZEKÂSI',139,108,27,'#b6ebc8');
  label('YARIŞ TARİHİ',67,191,25,'#e1c288');
  if(t>=2.7&&t<=15){
   const travel=ease((t-2.7)/12.3),x=-760+travel*1920,y=900+12*Math.sin(t*17),width=780,height=520;
   const alpha=smooth((t-2.7)/.5)*smooth((15-t)/.7);
   ctx.save();ctx.globalAlpha=alpha*.17;ctx.fillStyle='#1b140d';ctx.beginPath();ctx.ellipse(x+width*.54,1405,width*.42,19,0,0,Math.PI*2);ctx.fill();ctx.restore();
   ctx.save();ctx.globalAlpha=alpha*.15;ctx.drawImage(horse,x-35,y+12,width,height);ctx.restore();
   ctx.save();ctx.globalAlpha=alpha;ctx.drawImage(horse,x,y,width,height);ctx.restore();
  }
  const scenes=[
   {from:0,to:4.4,lines:[['1936',80,330,132],['GAZİ KOŞUSU',74,431,69],['Ankara Şehir Hipodromu',77,500,37]]},
   {from:4.1,to:10,lines:[['YENİ HİPODROM',75,331,63],['Yarış 1936’da Ankara’da koşuldu.',78,403,37]]},
   {from:9.7,to:15.2,lines:[['ŞİLEM',77,332,112],['Jokey: Paul',80,416,49],['Kayıtlı derece: 2:47',81,480,38]]},
   {from:14.9,to:18,lines:[['TARİHTEN BİR SAYFA',74,326,55],['Şilem · 1936 Gazi Koşusu',77,402,38]]},
  ];
  for(const scene of scenes){
   if(t<scene.from||t>scene.to)continue;
   const a=smooth((t-scene.from)/.55)*smooth((scene.to-t)/.55);
   ctx.save();ctx.globalAlpha=a;
   for(const [value,x,y,size] of scene.lines)label(value,x,y+17*(1-a),size,size>60?'#fff4dc':'#d9eacb');
   ctx.restore();
  }
  // Moving timeline, not a sequence of static slides.
  ctx.fillStyle='rgba(187,229,198,.3)';ctx.fillRect(68,1716,944,5);
  ctx.fillStyle='#e6c486';ctx.fillRect(68,1716,944*ease(t/18),5);
  ctx.beginPath();ctx.arc(68+944*ease(t/18),1718,10,0,Math.PI*2);ctx.fill();
  label('TEMSİLÎ CANLANDIRMA · GERÇEK YARIŞ GÖRÜNTÜSÜ DEĞİLDİR',67,1775,24,'#eee7d7',500);
  label('Kaynak: TJK · Atatürk Ansiklopedisi',68,1830,25,'#b6ebc8',500);
  return true;
 }
 window.draw=frame;
 window.cover=()=>{frame(7.5);ctx.fillStyle='rgba(2,16,25,.97)';ctx.fillRect(53,215,958,290);label('1936 GAZİ KOŞUSU',74,315,65);label('ŞİLEM · ANKARA',76,395,53,'#e6c486');};
 </script>`)
 await page.evaluate(()=>window.ready)
 for(let index=0;index<360;index++){
  await page.evaluate(t=>window.draw(t),index/20)
  await page.screenshot({path:resolve(root,'frames',`frame-${String(index).padStart(4,'0')}.jpg`),type:'jpeg',quality:84})
 }
 await page.evaluate(()=>window.cover())
 await page.screenshot({path:resolve(root,'cover.jpg'),type:'jpeg',quality:93})
}finally{await browser.close()}
const python='D:/Apps/HorseRide/.venv/Scripts/python.exe'
await exec(python,[resolve(root,'make-piano.py'),root],{windowsHide:true,timeout:30000})
const ffmpeg=(await exec(python,['-c','import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'],{windowsHide:true})).stdout.trim()
await exec(ffmpeg,['-y','-framerate','20','-i',resolve(root,'frames/frame-%04d.jpg'),'-i',resolve(root,'piano-original.wav'),'-vf','fps=30,format=yuv420p','-t','18','-c:v','libx264','-preset','medium','-crf','22','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-movflags','+faststart',resolve(root,'reel.mp4')],{windowsHide:true,timeout:240000,maxBuffer:50000})
const caption=`1936 Gazi Koşusu, Ankara Şehir Hipodromu’nda koşuldu. Türkiye Jokey Kulübü tarihçesine ve Atatürk Ansiklopedisi kayıtlarına göre yarışı Memduh Alan’ın Şilem’i, jokey Paul ile kazandı. Kayıtlı derece 2:47.\n\nBu video, tarihî sonucu anlatan temsili bir animasyondur; gerçek yarış görüntüsü veya yarış içindeki pozisyonların birebir canlandırması değildir. Arka plandaki kısa piyano ezgisi bu video için özgün olarak üretildi; üçüncü taraf müzik kaydı kullanılmadı.\n\nKaynaklar: https://gazi.tjk.org/History · https://ataturkansiklopedisi.gov.tr/bilgi/gazi-kosusu/?pdf=3651\n\n#GanyanZekası #GaziKoşusu #Şilem #YarışTarihi`
await writeFile(resolve(root,'caption.txt'),caption,'utf8')
console.log(JSON.stringify({file:resolve(root,'reel.mp4'),frames:360,durationSeconds:18,captionLength:caption.length,source:'TJK and Atatürk Ansiklopedisi',audio:'original piano'}))
