"""Continuous, original 2D documentary animation; no archive footage claim."""
from pathlib import Path
import sys,json,math,subprocess,random
import numpy as np
from PIL import Image,ImageDraw,ImageFont,ImageFilter
import imageio_ffmpeg
root=Path(sys.argv[1]);ep=json.loads((root/'episode.json').read_text(encoding='utf-8-sig'));timing=json.loads((root/'narration-timing.json').read_text(encoding='utf-8'))
W,H,FPS=720,1280,24;duration=timing['duration']+2;night_story=ep.get('visualMode')=='floodlit-animation'
font=lambda n:ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf',n)
def gradient(top,bottom):
    a=np.linspace(top,bottom,H).astype('uint8');return Image.fromarray(np.repeat(a[:,None,:],W,axis=1),'RGB')
day=gradient((45,76,87),(17,35,40));night=gradient((4,14,31),(14,33,42))
rng=random.Random(1993);stars=[(rng.randrange(W),rng.randrange(130,560),rng.random()) for _ in range(70)]
def wrap(d,text,f,width):
    out=['']
    for word in text.split():
        candidate=(out[-1]+' '+word).strip()
        if d.textlength(candidate,font=f)>width and out[-1]:out.append(word)
        else:out[-1]=candidate
    return out
def horse(d,x,y,s,t,color,number):
    # Procedural articulated gallop, not an animation of a named historical horse.
    phase=t*10;bounce=math.sin(phase*2)*4*s
    def pt(a,b):return (x+a*s,y+(b+bounce/s)*s)
    def line(points,fill,width):d.line([pt(*p) for p in points],fill=fill,width=max(1,int(width*s)),joint='curve')
    for i,(hip,offset) in enumerate([((-48,8),0),((-37,10),2.2),((43,8),math.pi),((51,10),math.pi+1.6)]):
        angle=phase+offset;knee=(hip[0]+math.sin(angle)*34,48+math.cos(angle)*10);hoof=(knee[0]+math.sin(angle+1.1)*32,77-22*max(0,math.sin(angle)))
        line([hip,knee,hoof], '#0c141c' if i%2 else color,10)
        line([hoof,(hoof[0]+11,hoof[1]+1)],'#d0b888',5)
    d.ellipse((pt(-64,-34),pt(61,26)),fill=color)
    d.polygon([pt(31,-24),pt(68,-83),pt(90,-77),pt(68,3)],fill=color)
    d.ellipse((pt(65,-94),pt(108,-63)),fill=color)
    d.polygon([pt(87,-86),pt(126,-65),pt(120,-52),pt(91,-61)],fill=color)
    d.polygon([pt(72,-89),pt(73,-113),pt(83,-92)],fill=color)
    d.ellipse((pt(96,-83),pt(99,-80)),fill='#e5c788')
    line([(-56,-21),(-91,-10+10*math.sin(phase)),(-107,7+12*math.sin(phase+.8))],color,12)
    # Cloth and anonymous rider, with no historic racing colours asserted.
    d.polygon([pt(-23,-35),pt(23,-35),pt(24,3),pt(-19,3)],fill='#bfa36f')
    line([(-9,-37),(7,-70),(43,-87)],'#b4d3ca',13)
    line([(12,-64),(36,-54),(74,-66)],'#d6ded2',5)
    line([(-4,-36),(18,-12),(29,17)],'#15232a',8)
    d.ellipse((pt(38,-111),pt(60,-89)),fill='#d8c29a');d.arc((pt(34,-114),pt(63,-91)),180,355,fill='#7ea999',width=max(2,int(8*s)))
    line([(70,-68),(116,-61)],'#c3bc9a',2)
    d.text(pt(-7,-21),str(number),font=font(max(9,int(14*s))),fill='#17232b')
words=timing['words'];cues=[]
for i in range(0,len(words),6):
    a=words[i:i+6];cues.append((a[0]['start']+.5,a[-1]['end']+.55,' '.join(w['text'] for w in a)))
beats=timing.get('beats',[])
def cue_time(fragment,fallback):return next((b['start']+.5 for b in beats if fragment in b['text']),fallback)
lights_at=cue_time('asıl fark',10);queen_at=cue_time('1994',23);tapeta_at=cue_time('2014',30)
ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
proc=subprocess.Popen([ffmpeg,'-y','-f','rawvideo','-vcodec','rawvideo','-s',f'{W}x{H}','-pix_fmt','rgb24','-r',str(FPS),'-i','-','-i',str(root/'narration.wav'),'-filter_complex','[1:a]adelay=500|500,apad[a]','-map','0:v','-map','[a]','-t',str(duration),'-vf','scale=1080:1920:flags=lanczos,format=yuv420p','-c:v','libx264','-preset','fast','-crf','19','-c:a','aac','-b:a','192k','-movflags','+faststart',str(root/'reel.mp4')],stdin=subprocess.PIPE,stdout=subprocess.DEVNULL,stderr=(root/'render.log').open('w'))
for frame in range(math.ceil(duration*FPS)):
    t=frame/FPS;dark=min(1,max(0,(t-3)/7)) if night_story else .35
    im=Image.blend(day,night,dark).convert('RGBA');d=ImageDraw.Draw(im)
    for sx,sy,v in stars:
        a=int(dark*(100+65*math.sin(t*.7+v*6)));d.ellipse((sx,sy,sx+1,sy+1),fill=(190,213,221,max(0,a)))
    # Distant anonymous architecture and parallax ground stay on screen throughout.
    for layer in range(2):
        for i in range(-2,9):
            x=int(i*110-(t*(3+layer*3))%110);y=545+layer*42
            d.rectangle((x,y,x+95,y+90),fill=('#142c37' if layer==0 else '#1e3c43'))
            d.polygon([(x-8,y),(x+48,y-34),(x+104,y)],fill='#213e47')
            for j in range(5):d.line((x+j*22,y+10,x+j*22,y+82),fill='#4c6b6c',width=2)
    d.rectangle((0,680,W,1000),fill='#263f3e');d.polygon([(0,795),(W,720),(W,1030),(0,1030)],fill='#5e594b' if t<tapeta_at else '#5b6470')
    for i in range(45):
        x=(i*67-t*125)%(W+100)-50;y=820+i%7*20
        d.line((x,y,x+25,y-2),fill='#79745b',width=1)
    # Moving railings give a continuous camera-tracking effect.
    for y,speed in [(690,35),(960,110)]:
        d.line((0,y,W,y-42),fill='#d5cbb1',width=5)
        for i in range(-1,10):
            x=int(i*100-(t*speed)%100);base=y-x*.058;d.line((x,base,x,base+68),fill='#a9bcb6',width=4)
    glow=Image.new('RGBA',(W,H));gd=ImageDraw.Draw(glow)
    for i in range(4):
        x=55+i*205-int((t*8)%30);y=430+i%2*22
        d.line((x,y,x,732),fill='#809592',width=7);d.rectangle((x-22,y-8,x+22,y+8),fill='#455967')
        brightness=min(1,max(0,(t-lights_at-i*.22)/1.1)) if night_story else .15
        if brightness:
            gd.polygon([(x-15,y),(x+15,y),(x+250,930),(x-210,930)],fill=(250,226,161,int(17*brightness)))
            for radius in range(28,3,-3):gd.ellipse((x-radius,y-radius,x+radius,y+radius),fill=(255,230,158,int(brightness*(60-radius))))
            d.rectangle((x-18,y-4,x+18,y+4),fill=(255,245,197,int(255*brightness)))
    im=Image.alpha_composite(im,glow.filter(ImageFilter.GaussianBlur(3)));d=ImageDraw.Draw(im)
    # Three anonymous horses genuinely gallop; no claimed finishing positions.
    for i,(x,y,s,col) in enumerate([(555,774,.85,'#63594d'),(470,824,1.1,'#3f3932'),(265,867,1.48,'#4d3a2b')]):
        x+=16*math.sin(t*.8+i);d.ellipse((x-75*s,y+76*s,x+65*s,y+88*s),fill=(3,10,15,110));horse(d,x,y,s,t+i*.6,col,i+1)
    for i in range(25):
        age=(t*2+i*.17)%1;x=210-age*160+i%3*12;y=1002-age*70
        d.ellipse((x,y,x+3+age*5,y+2+age*3),fill=(197,184,143,int((1-age)*50)))
    # Documentary typography and timeline animate over one continuous scene.
    d.rounded_rectangle((28,28,345,72),radius=10,fill=(4,18,26,220));d.text((43,38),'GANYAN ZEKÂSI',font=font(22),fill='#e9d2a5')
    venue=ep.get('venueLabel',ep['countryLabel']).replace(' Hipodromu','')
    d.text((35,109),venue.upper(),font=font(30),fill='#a8dfca')
    for i,line in enumerate(wrap(d,ep['title'],font(40),645)[:3]):d.text((35,160+i*48),line,font=font(40),fill='#fff0d3')
    if night_story:
        year='1993' if t<queen_at else ('1994' if t<tapeta_at else '2014')
        label='PROJEKTÖRLER' if t<queen_at else ('YENİDEN AÇILIŞ' if t<tapeta_at else 'TAPETA DÖNEMİ')
    else:year=str(ep['year']);label='YARIŞ TARİHİ'
    d.text((35,326),year,font=font(100),fill='#e2c289');d.text((39,444),label,font=font(22),fill='#b5d2cb')
    band=Image.new('RGBA',(W,H));bd=ImageDraw.Draw(band);bd.rectangle((0,1040,W,H),fill=(3,14,23,222));im=Image.alpha_composite(im,band);d=ImageDraw.Draw(im)
    cue=next((c[2] for c in cues if c[0]<=t<c[1]),'')
    for i,line in enumerate(wrap(d,cue,font(28),645)[:3]):d.text((W//2,1068+i*40),line,font=font(28),fill='#fff5e4',anchor='mt')
    d.text((35,1210),'ÖZGÜN 2D ANLATIM · GERÇEK YARIŞ KAYDI DEĞİLDİR',font=font(15),fill='#9fb6b7')
    d.line((35,1250,35+650*t/duration,1250),fill='#d4b77e',width=3)
    if frame==12:im.convert('RGB').save(root/'cover.jpg',quality=95)
    if frame in (int(FPS*lights_at)+48,int(FPS*tapeta_at)+24):im.convert('RGB').save(root/f'qa-{frame}.jpg',quality=95)
    proc.stdin.write(im.convert('RGB').tobytes())
proc.stdin.close()
if proc.wait()!=0:raise RuntimeError('motion_render_failed')
(root/'render-report.json').write_text(json.dumps({'duration':duration,'fps':FPS,'frames':frame+1,'local':True,'voiceStyle':timing.get('voiceStyle'),'visualStyle':'continuous-2d-documentary-v1','movingSubjects':True,'sources':ep['sources']},ensure_ascii=False),encoding='utf-8')
