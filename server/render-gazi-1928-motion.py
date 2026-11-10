from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageSequence,ImageFilter,ImageOps
import numpy as np,math,subprocess,wave,json,hashlib
import imageio_ffmpeg
from scipy.ndimage import label
ROOT=Path(r'D:\Apps\HorseRide\data\instagram\history-gazi-1928-rebuild');OUT=ROOT/'gazi-1928-motion-preview.mp4'
W,H,FPS=720,1280,24
with wave.open(str(ROOT/'narration.wav')) as a:DURATION=a.getnframes()/a.getframerate()
ink='#233337';gold='#927343';muted='#6b7167';paper='#eee5d0'
def font(n,bold=False):return ImageFont.truetype('C:/Windows/Fonts/'+('georgiab.ttf' if bold else 'georgia.ttf'),n)
def sans(n):return ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',n)
F={n:font(n,n>=48) for n in [20,24,30,34,42,48,58,68,84,112,152]}
# The measured photographic gait keeps all limb poses coherent. This is an ink
# animation study, never represented as film of Primerole or of the 1928 race.
poses=[]
for frame in ImageSequence.Iterator(Image.open(ROOT/'muybridge-motion.gif')):
 gray=np.asarray(frame.convert('RGB').convert('L'));alpha=np.where(gray<95,255,0).astype('uint8');alpha[:7]=0;alpha[-22:]=0;alpha[:,:7]=0;alpha[:,-7:]=0
 components,n=label(alpha>0);sizes=np.bincount(components.ravel());sizes[0]=0;alpha=np.where(components==sizes.argmax(),255,0).astype('uint8')
 mask=Image.fromarray(alpha).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(.7));mask=mask.resize((650,430),Image.Resampling.LANCZOS)
 poses.append(mask)
rng=np.random.default_rng(1928);noise=rng.normal(0,1.3,(H,W,1));base=np.clip(np.array([238,229,208])[None,None,:]+noise,0,255).astype('uint8');base=Image.fromarray(base)
def centered(draw,text,y,f,fill=ink):
 box=draw.textbbox((0,0),text,font=f);draw.text(((W-(box[2]-box[0]))/2,y),text,font=f,fill=fill)
def ease(x):return (1-math.cos(math.pi*max(0,min(1,x))))/2
def horse(im,t,x,y,scale=1,color=ink):
 mask=poses[int(t*10)%len(poses)];mask=mask.resize((int(mask.width*scale),int(mask.height*scale)),Image.Resampling.LANCZOS)
 layer=Image.new('RGB',mask.size,color);im.paste(layer,(int(x),int(y+math.sin(t*math.tau*1.6)*2)),mask)
def frame_at(t):
 im=base.copy();d=ImageDraw.Draw(im)
 # Moving foreground rails, distant fence and small flags create three planes.
 d.line((42,100,678,100),fill=gold,width=2);d.text((44,58),'GAZİ KOŞUSU TARİHİ',font=sans(22),fill=muted);d.text((583,58),'BÖLÜM 02',font=sans(18),fill=muted)
 for y,speed in [(655,10),(870,35),(927,55)]:
  d.line((0,y,W,y),fill=gold,width=2)
  for k in range(-1,10):
   x=k*105-(t*speed)%105;d.line((x,y-25,x,y+54),fill=gold,width=2)
 for k in range(8):
  x=k*135-(t*7)%135;d.line((x,503,x,585),fill='#b5a88a',width=1)
  flag=12+3*math.sin(t*3+k);d.polygon([(x,503),(x+27,503+flag/2),(x,503+flag)],fill='#b9a580')
 # A continuously moving, period-neutral silhouette; no generated faces/legs.
 horse(im,t,35+9*math.sin(t*.35),477,1)
 d=ImageDraw.Draw(im)
 if t<4:
  centered(d,'İKİNCİ GAZİ',170,F[48]);centered(d,'1928',237,F[152]);centered(d,'ANKARA',427,F[24],gold)
  p=ease(t/3);d.line((90,1035,90+540*p,1035),fill=gold,width=3)
  centered(d,'Kazananla birlikte',1054,F[30]);centered(d,'kurallar da değişiyordu.',1100,F[30])
 elif t<10:
  centered(d,'AYNI İSİM',167,F[30],gold);centered(d,'YENİ KOŞULLAR',228,F[58]);
  centered(d,'Açık koşu',330,F[42]);centered(d,'Yaşa göre sıklet',400,F[34],muted)
  for i,label in enumerate(['YAŞ','SIKLET','AÇIK KOŞU']):
   x=90+i*220;p=ease((t-4-i*.15)/.8);d.arc((x-36,1050,x+36,1122),-90,-90+int(359*p),fill=gold,width=3);d.text((x-35,1140),label,font=sans(18),fill=ink)
 elif t<14:
  centered(d,'ŞEREF LİSTESİNDEKİ İSİM',165,F[24],gold);centered(d,'PRIMEROLE',235,F[68]);centered(d,'Sahibi: Atıf Bey',355,F[34]);
  d.ellipse((294,1000,426,1132),outline=gold,width=3);centered(d,'II',1012,F[84]);centered(d,'1928 GALİBİ',1173,F[24],muted)
 elif t<21:
  centered(d,'KAYDA GEÇEN DERECE',167,F[24],gold);centered(d,'2:44',235,F[112]);centered(d,'Jokey: Yula',393,F[34])
  p=ease((t-14)/6);d.arc((260,1005,460,1205),-90,-90+359*p,fill=gold,width=4);d.line((360,1105,360+75*math.sin(p*math.tau),1105-75*math.cos(p*math.tau)),fill=ink,width=3);d.ellipse((353,1098,367,1112),fill=ink)
 elif t<24.5:
  centered(d,'KOŞUNUN İKRAMİYESİ',167,F[24],gold);centered(d,'2.500',235,F[112]);centered(d,'LİRA',388,F[30]);centered(d,'Dönemin tarihî kaydı',1065,F[30],muted)
  p=ease((t-21)/2);d.line((110,1140,110+500*p,1140),fill=gold,width=3)
 else:
  centered(d,'1928',169,F[84]);centered(d,'PRIMEROLE',293,F[58]);centered(d,'Gazi tarihinin ikinci sayfası',395,F[24],muted)
  centered(d,'GELECEK BÖLÜM',1020,F[20],gold);centered(d,'1929',1070,F[84])
 centered(d,'Temsili animasyon · Muybridge hareket çalışması',1232,sans(17),muted)
 return im
ff=imageio_ffmpeg.get_ffmpeg_exe();temp=ROOT/'gazi-silent.tmp.mp4'
p=subprocess.Popen([ff,'-y','-v','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','pipe:0','-an','-c:v','libx264','-threads','2','-preset','fast','-crf','18','-pix_fmt','yuv420p',str(temp)],stdin=subprocess.PIPE)
try:
 for i in range(math.ceil(DURATION*FPS)):p.stdin.write(frame_at(i/FPS).tobytes())
finally:p.stdin.close()
assert p.wait(timeout=120)==0
subprocess.run([ff,'-y','-v','error','-i',str(temp),'-i',str(ROOT/'narration.wav'),'-map','0:v:0','-map','1:a:0','-c:v','copy','-af','loudnorm=I=-16:TP=-1.5:LRA=11','-c:a','aac','-b:a','160k','-t',str(DURATION),'-movflags','+faststart',str(OUT)],check=True,timeout=120)
frame_at(11).save(ROOT/'cover.jpg');frame_at(11).save(r'C:\Users\desscartes\Documents\ChatGPT\Ganyan Zekası\work\gazi-new-preview.jpg')
stream=imageio_ffmpeg.read_frames(str(OUT),output_params=['-vf','scale=180:320']);metadata=next(stream);count=black=0
for count,pixels in enumerate(stream,1):
 if max(pixels)<=1:black+=1
assert not black and abs(count/metadata['fps']-DURATION)<.2
meta={'status':'new_style_preview_not_approved','duration':DURATION,'voice':'tr-TR-EmelNeural','day':'2026-11-06','publishing':False,'renderMethod':'original-local-ink-motion-design','sourceMotion':'https://commons.wikimedia.org/wiki/File:Muybridge_race_horse_animated.gif','motionLicense':'Public domain','disclosure':'Original illustrative animation using Muybridge locomotion studies; not 1928 Ankara or Primerole archival footage.','sha256':hashlib.sha256(OUT.read_bytes()).hexdigest(),'baseline':'Fio Rito visual-v7/native-v6; no automatic quality approval implied'}
(ROOT/'new-preview-report.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(meta,ensure_ascii=False))
