from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,hashlib,shutil,subprocess,wave
import imageio_ffmpeg
BASE=Path(__file__).parent;APP=Path('D:/Apps/HorseRide');OUT=APP/'data/instagram/history-gazi-1928-documentary';OUT.mkdir(exist_ok=True)
OLD=APP/'data/instagram/history-gazi-1928-real-edit';ff=imageio_ffmpeg.get_ffmpeg_exe()
for n in ['narration.wav','narration.txt','episode.json','voice-source.json']:shutil.copy2(OLD/n,OUT/n)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def font(n,bold=False):return ImageFont.truetype('C:/Windows/Fonts/'+('segoeuib.ttf' if bold else 'segoeui.ttf'),n)
def card(name,heading,lines,footer):
 im=Image.new('RGB',(720,1280),'#1a252b');d=ImageDraw.Draw(im);d.rectangle((55,265,665,960),fill='#eee7d8');d.line((85,350,635,350),fill='#946b38',width=3)
 d.text((85,300),heading,font=font(25,True),fill='#624a2e')
 for i,line in enumerate(lines):d.text((85,425+i*75),line,font=font(37,True),fill='#1a252b')
 d.text((85,865),footer,font=font(20),fill='#444444');im.save(OUT/name)
card('memoir.png','SAİT AKSON’UN ANILARINDAN',['“1928 senesi Gazi','Koşusu’na gene','dört at girdi.”'],'TJK · Yarışçılık Anıları · kısa alıntı')
card('record.png','1928 · İKİNCİ GAZİ KOŞUSU',['PRIMEROLE','At sahibi: Atıf Bey','Jokey: Yula'],'Kaynak: Atatürk Ansiklopedisi · bilgi özeti')
for src,dest in [('ankara-1926.jpg','ankara-1926.jpg'),('ankara-1928.jpg','ankara-1928.jpg')]:shutil.copy2(BASE/src,OUT/dest)
shutil.copy2(OLD/'source-29457543.mp4',OUT/'horse-motion.mp4')
ev={
 'city':{'file':'ankara-1926.jpg','place':'Ankara','year':1926,'relation':'period_context','rights':'Public domain','source':'https://commons.wikimedia.org/wiki/File:Turkije,_SFA022824255.jpg','description':'Ankara Postanesi,1926; Opera Meydanı veya ahır değil'},
 'assembly':{'file':'ankara-1928.jpg','place':'Ankara','year':1928,'relation':'period_context','rights':'Public domain','source':'https://commons.wikimedia.org/wiki/File:Grand_National_Assembly_of_Turkey_(1928).jpg','description':'1928 TBMM oturumu; yarış seyircisi değil'},
 'memoir':{'file':'memoir.png','place':'Ankara','year':1928,'relation':'primary_text','rights':'Original layout; attributed short quotation','source':'https://medya-cdn.tjk.org/medyaftp/pdf/SAITAKSON_YARISCILIK_ANILARI.pdf','description':'Modern alıntı düzeni; tarihî gazete sayfası değil'},
 'record':{'file':'record.png','place':'Ankara','year':1928,'relation':'direct_event','rights':'Original factual summary layout','source':'https://ataturkansiklopedisi.gov.tr/detay/476/Gazi-Ko%C5%9Fusu','description':'Modern bilgi özeti; özgün 1928 belgesi değil'},
 'horse':{'file':'horse-motion.mp4','place':None,'year':2024,'relation':'illustration','rights':'Pexels','source':'https://www.pexels.com/video/majestic-horse-running-through-lush-forest-landscape-29457543/','description':'Primerole değil; temsili doğal at hareketi'} }
for v in ev.values():v.update(sha256=sha(OUT/v['file']),sourceChecked=True)
shots=[('city',5.2,'Ankara Postanesi · 1926 | Dönem bağlamı'),('assembly',4.6,'TBMM oturumu · Ankara, 1928 | Dönem bağlamı'),('memoir',4.3,'Sait Akson · TJK yayımlı anılardan'),('record',5.1,'1928 Gazi · Kaynaklı bilgi özeti'),('horse',4.3,'Temsili hareket · Primerole’nin görüntüsü değildir'),('city',4.8,'Ankara Postanesi · 1926 | Arşiv ayrıntısı'),('assembly',4.66,'Ankara · 1928 | Yarış görüntüsü değildir')]
parts=[];timeline=[];start=0
for i,(key,length,label) in enumerate(shots):
 asset=ev[key];p=OUT/asset['file'];part=OUT/f'doc-part-{i}.mp4'
 still=p.suffix=='.png' or p.suffix=='.jpg'
 if key=='horse':vf='split[b][f];[b]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,gblur=sigma=28[bg];[f]scale=720:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,fps=24'
 elif key in ['memoir','record']:vf='scale=720:1280,fps=24'
 else:vf="scale=1440:-2,zoompan=z='1.02+0.00045*on':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=720x1280:fps=24" if i%2 else "scale=1440:-2,pad=1440:2560:(ow-iw)/2:(oh-ih)/2:color=0x1a252b,zoompan=z='1.02+0.0006*on':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=720x1280:fps=24"
 if key in ['city','assembly']:vf="scale=1440:-2,pad=1440:2560:(ow-iw)/2:(oh-ih)/2:color=0x1a252b,zoompan=z='1.02+0.0006*on':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=720x1280:fps=24"
 args=['-loop','1'] if still else []
 with (OUT/'render.log').open('a',encoding='utf-8') as log:subprocess.run([ff,'-y',*args,'-i',str(p),'-t',str(length),'-vf',vf+',setsar=1','-an','-c:v','libx264','-threads','2','-preset','fast','-crf','18','-pix_fmt','yuv420p',str(part)],stdout=log,stderr=log,check=True,timeout=90)
 timeline.append({'asset':key,'start':round(start,2),'end':round(start+length,2),'label':label,'renderedClip':part.name,'clipSha256':sha(part)});start+=length;parts.append(part)
# Reuse readable subtitle styling and narration; replace generic intro/disclosure with exact per-shot labels.
ass=(OLD/'titles.ass').read_text(encoding='utf-8');lines=[]
for line in ass.splitlines():
 if line.startswith('Dialogue:') and (',Title,' in line or ',Note,' in line):continue
 lines.append(line)
def ts(t):
 n=round(t*100);h,n=divmod(n,360000);m,n=divmod(n,6000);s,c=divmod(n,100);return f'{h}:{m:02}:{s:02}.{c:02}'
for shot in timeline:lines.append(f"Dialogue: 0,{ts(shot['start'])},{ts(shot['end'])},Note,,0,0,0,,{shot['label']}")
lines.append('Dialogue: 0,0:00:00.00,0:00:04.50,Title,,0,0,0,,ANKARA’NIN YARIŞ HAFIZASI\\N1928 · İKİNCİ GAZİ')
(OUT/'titles.ass').write_text('\n'.join(lines),encoding='utf-8');(OUT/'concat.txt').write_text('\n'.join("file '"+p.as_posix()+"'" for p in parts),encoding='utf-8')
target=OUT/'gazi-1928-documentary.mp4'
with (OUT/'render.log').open('a',encoding='utf-8') as log:subprocess.run([ff,'-y','-f','concat','-safe','0','-i',str(OUT/'concat.txt'),'-i',str(OUT/'narration.wav'),'-vf','subtitles=titles.ass','-t','32.96','-c:v','libx264','-threads','2','-preset','fast','-crf','18','-c:a','aac','-b:a','192k','-movflags','+faststart',str(target)],cwd=OUT,stdout=log,stderr=log,check=True,timeout=150)
subprocess.run([ff,'-v','error','-i',str(target),'-f','null','-'],check=True,capture_output=True,timeout=60)
manifest={'route':'documentary','place':'Ankara','year':1928,'duration':32.96,'assets':ev,'timeline':timeline,'videoFile':target.name,'videoSha256':sha(target),'voiceSha256':sha(OUT/'narration.wav'),'narrationSha256':sha(OUT/'narration.txt'),'status':'preview_not_published','copyrightNotes':'SALT/1924map excluded for conflicting/restrictive rights; two PD archival photos, attributed 9-word memoir quote, own factual layout, licensed brief illustrative motion.'}
(OUT/'context-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8');print(str(target))
