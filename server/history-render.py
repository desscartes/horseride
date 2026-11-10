from pathlib import Path
import sys,json,math,subprocess
from PIL import Image,ImageDraw,ImageFont,ImageEnhance
import imageio_ffmpeg
root=Path(sys.argv[1]); base=Path('D:/Apps/HorseRide')
ep=json.loads((root/'episode.json').read_text(encoding='utf-8-sig'))
if ep.get('visualMode')=='real-venue-archive':
    subprocess.run([sys.executable,str(Path(__file__).with_name('render-history-archive.py')),str(root)],check=True)
    sys.exit(0)
if ep.get('visualMode') in ('floodlit-animation','continuous-track-animation'):
    subprocess.run([sys.executable,str(Path(__file__).with_name('render-history-motion.py')),str(root)],check=True)
    sys.exit(0)
timing=json.loads((root/'narration-timing.json').read_text(encoding='utf-8'))
sheet=Image.open(base/'public/social/history-library.png').convert('RGB')
scenes=[sheet.crop((c*sheet.width//3,r*sheet.height//2,(c+1)*sheet.width//3,(r+1)*sheet.height//2)) for r in range(2) for c in range(3)]
sprites=[Image.open(base/f'work/instagram-news/gazi-series/1927/horse-frame-{i}.png').convert('RGBA') for i in range(4)]
font=lambda n:ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf',n)
W,H=720,1280;fps=24;duration=timing['duration']+2
def wrapped(draw,text,f,maxwidth):
    lines=['']
    for word in text.split():
        candidate=(lines[-1]+' '+word).strip()
        if draw.textlength(candidate,font=f)>maxwidth and lines[-1]:lines.append(word)
        else:lines[-1]=candidate
    return lines
ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
proc=subprocess.Popen([ffmpeg,'-y','-f','rawvideo','-vcodec','rawvideo','-s',f'{W}x{H}','-pix_fmt','rgb24','-r',str(fps),'-i','-','-i',str(root/'narration.wav'),'-filter_complex','[1:a]adelay=500|500,apad[a]','-map','0:v','-map','[a]','-t',str(duration),'-vf','scale=1080:1920:flags=lanczos,format=yuv420p','-c:v','libx264','-preset','fast','-crf','20','-c:a','aac','-b:a','160k','-movflags','+faststart',str(root/'reel.mp4')],stdin=subprocess.PIPE,stdout=subprocess.DEVNULL,stderr=(root/'render.log').open('w'))
words=timing['words'];cues=[]
for i in range(0,len(words),6):
    part=words[i:i+6];cues.append((part[0]['start']+.5,part[-1]['end']+.65,' '.join(w['text'] for w in part)))
for frame in range(math.ceil(duration*fps)):
    t=frame/fps;scene=min(5,int(t/duration*6));p=(t/duration*6)%1
    img=scenes[scene];scale=max(W/img.width,H/img.height)*(1.02+.09*p)
    image=img.resize((int(img.width*scale),int(img.height*scale)),Image.Resampling.LANCZOS)
    x=(image.width-W)//2+int(12*math.sin(t*.25));y=(image.height-H)//2
    image=image.crop((max(0,x),max(0,y),max(0,x)+W,max(0,y)+H)).convert('RGBA')
    shade=Image.new('RGBA',(W,H));sd=ImageDraw.Draw(shade)
    sd.rectangle((0,0,W,250),fill=(6,20,22,130));sd.rectangle((0,1000,W,H),fill=(6,20,22,170));image=Image.alpha_composite(image,shade)
    if scene==4:
        sprite=sprites[int(t*8)%4].copy();sprite.thumbnail((610,430));image.alpha_composite(sprite,(40+int(18*math.sin(t)),470+int(5*math.sin(t*16))))
    d=ImageDraw.Draw(image);d.text((38,36),'GANYAN ZEKÂSI',font=font(22),fill='#f4dfab')
    d.text((38,81),ep['countryLabel'].upper()+' · '+str(ep['year']),font=font(25),fill='#a7e2cd')
    for i,line in enumerate(wrapped(d,ep['title'],font(37),640)[:3]):d.text((38,127+i*46),line,font=font(37),fill='#fff5df',stroke_width=1,stroke_fill='#112021')
    cue=next((c[2] for c in cues if c[0]<=t<c[1]),'')
    for i,line in enumerate(wrapped(d,cue,font(28),640)[:3]):d.text((W//2,1065+i*39),line,font=font(28),fill='#fff9eb',anchor='mt',stroke_width=2,stroke_fill='#172023')
    d.text((38,1210),'YARIŞ TARİHİ · TEMSİLİ CANLANDIRMA',font=font(17),fill='#e9d7af')
    d.line((38,1248,38+644*t/duration,1248),fill='#e9d7af',width=3)
    if frame==12:image.convert('RGB').save(root/'cover.jpg',quality=94)
    proc.stdin.write(image.convert('RGB').tobytes())
proc.stdin.close()
if proc.wait()!=0:raise RuntimeError('ffmpeg_render_failed')
(root/'render-report.json').write_text(json.dumps({'duration':duration,'fps':fps,'frames':frame+1,'local':True,'audio':'EMA local Turkish','voiceStyle':timing.get('voiceStyle'),'sources':ep['sources']},ensure_ascii=False),encoding='utf-8')
