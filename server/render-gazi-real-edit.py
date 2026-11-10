from pathlib import Path
import subprocess,json,hashlib,wave,shutil
import imageio_ffmpeg
BASE=Path(__file__).parent;OUT=Path('D:/Apps/HorseRide/data/instagram/history-gazi-1928-real-edit');OUT.mkdir(exist_ok=True)
VOICE=Path('D:/Apps/HorseRide/data/instagram/history-gazi-1928-hybrid-v2')
for n in ['narration.wav','narration.txt','voice-source.json','episode.json']:shutil.copy2(VOICE/n,OUT/n)
ff=imageio_ffmpeg.get_ffmpeg_exe();sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
with wave.open(str(OUT/'narration.wav')) as w:duration=w.getnframes()/w.getframerate()
sources={'5206796':('Taryn Elliott','https://www.pexels.com/video/a-close-up-of-a-brown-horse-5206796/',BASE/'real-5206796.mp4'),'8624898':('RDNE Stock project','https://www.pexels.com/video/close-up-shot-of-horse-riding-safety-equipment-8624898/',BASE/'real-8624898.mp4'),'8064253':('Los Muertos Crew','https://www.pexels.com/video/a-person-adjusting-a-horse-saddle-8064253/',BASE/'real-8064253.mp4'),'29457543':('Ovais Ibn farooq','https://www.pexels.com/video/majestic-horse-running-through-lush-forest-landscape-29457543/',BASE/'gazi-candidate-29457543.mp4')}
for key,(author,url,path) in list(sources.items()):
 target=OUT/f'source-{key}.mp4';shutil.copy2(path,target);sources[key]=(author,url,target)
cuts=[('8624898',0,5.2),('8064253',0,4.8),('5206796',1,4),('29457543',.3,5.2),('8064253',8,5.5),('5206796',8,5.5),('8624898',7,duration-30.2)]
assert 0<cuts[-1][2]<3.2
parts=[]
for i,(key,start,length) in enumerate(cuts):
 source=sources[key][2];part=OUT/f'part-{i}.mp4'
 if key=='8624898':vf='crop=675:1200:100:650,scale=720:1280'
 elif key=='8064253':vf='crop=810:1440:50:400,scale=720:1280'
 elif key=='5206796':vf='crop=607:1080:700:0,scale=720:1280'
 else:vf='split[b][f];[b]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,gblur=sigma=30[bg];[f]scale=720:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2'
 vf+=',eq=saturation=0.45:contrast=1.04:brightness=0.01,fps=24,setsar=1'
 with (OUT/'render.log').open('a',encoding='utf-8') as log:subprocess.run([ff,'-y','-ss',str(start),'-i',str(source),'-t',str(length),'-vf',vf,'-an','-c:v','libx264','-threads','2','-preset','fast','-crf','18','-pix_fmt','yuv420p',str(part)],stdout=log,stderr=log,check=True,timeout=100)
 parts.append(part)
(OUT/'concat.txt').write_text('\n'.join("file '"+p.as_posix()+"'" for p in parts),encoding='utf-8')
def ts(t):
 n=round(t*100);h,n=divmod(n,360000);m,n=divmod(n,6000);s,c=divmod(n,100);return f'{h}:{m:02}:{s:02}.{c:02}'
ass='''[Script Info]
ScriptType: v4.00+
PlayResX: 720
PlayResY: 1280
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Title,Segoe UI,38,&H00FFFFFF,&H00FFFFFF,&H00202020,&H90000000,-1,0,0,0,100,100,0,0,1,2,0,8,45,45,135,1
Style: Sub,Segoe UI,33,&H00FFFFFF,&H00FFFFFF,&H00202020,&H90000000,0,0,0,0,100,100,0,0,1,2,0,2,45,45,210,1
Style: Note,Segoe UI,21,&H00FFFFFF,&H00FFFFFF,&H00202020,&H90000000,0,0,0,0,100,100,0,0,1,1,0,2,30,30,145,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
'''
ass+=f'Dialogue: 0,0:00:00.00,0:00:04.50,Title,,0,0,0,,ANKARA’NIN AHIRLARINDAN\\N1928 GAZİ KOŞUSU’NA\n'
ass+=f'Dialogue: 0,0:00:00.00,{ts(duration)},Note,,0,0,0,,Temsili çekimler · 1928 yarış arşivi değildir\n'
words=(OUT/'narration.txt').read_text(encoding='utf-8').split();total=len(words)
for i in range(0,total,7):
 text=' '.join(words[i:i+7]);text=text.replace('Primerole','Primerole')
 ass+=f'Dialogue: 0,{ts(duration*i/total)},{ts(duration*min(i+7,total)/total)},Sub,,0,0,0,,{text}\n'
(OUT/'titles.ass').write_text(ass,encoding='utf-8')
target=OUT/'gazi-1928-real-edit.mp4'
with (OUT/'render.log').open('a',encoding='utf-8') as log:subprocess.run([ff,'-y','-f','concat','-safe','0','-i',str(OUT/'concat.txt'),'-i',str(OUT/'narration.wav'),'-vf','subtitles=titles.ass','-t',str(duration),'-c:v','libx264','-threads','2','-preset','fast','-crf','18','-c:a','aac','-b:a','192k','-movflags','+faststart',str(target)],cwd=OUT,stdout=log,stderr=log,check=True,timeout=120)
subprocess.run([ff,'-v','error','-i',str(target),'-f','null','-'],check=True,capture_output=True,timeout=60)
report={'status':'rendered_for_visual_review','file':str(target),'videoSha256':sha(target),'duration':duration,'generatedVideo':False,'paidVideoService':False,'published':False,'sourceAudioUsed':False,'musicUsed':False,'sources':[{'id':key,'author':a,'url':u,'license':'https://www.pexels.com/license/','sha256':sha(p)} for key,(a,u,p) in sources.items()],'cuts':cuts,'disclosure':'Modern illustrative horse-care and locomotion footage; not Primerole, not 1928 Ankara or footage of the historical race.'}
(OUT/'real-edit-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(report,ensure_ascii=False))

