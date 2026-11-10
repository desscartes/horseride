from pathlib import Path
import sys,json,math,subprocess
from PIL import Image,ImageDraw,ImageFont,ImageFilter,ImageEnhance
import imageio_ffmpeg
root=Path(sys.argv[1]);base=Path('D:/Apps/HorseRide');ep=json.loads((root/'episode.json').read_text(encoding='utf-8-sig'));timing=json.loads((root/'narration-timing.json').read_text(encoding='utf-8'))
W,H,FPS=720,1280,24;duration=timing['duration']+2;assets=ep['assets'];images=[Image.open(base/a['local']).convert('RGB') for a in assets];font=lambda n:ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf',n)
def wrap(d,text,f,width):
    lines=['']
    for word in text.split():
        candidate=(lines[-1]+' '+word).strip()
        if d.textlength(candidate,font=f)>width and lines[-1]:lines.append(word)
        else:lines[-1]=candidate
    return lines
def frame_of(index,t):
    source=images[index];zoom=1.03+.04*math.sin(t*.09+index);scale=max(W/source.width,H/source.height)*zoom
    bg=source.resize((int(source.width*scale),int(source.height*scale)),Image.Resampling.BILINEAR);left=(bg.width-W)//2;top=(bg.height-H)//2;bg=bg.crop((left,top,left+W,top+H)).filter(ImageFilter.GaussianBlur(16));bg=ImageEnhance.Brightness(bg).enhance(.24).convert('RGBA')
    # Whole original image remains visible, with small continuous camera drift and a documentary matte.
    box=(668,648);fg=source.copy();fg.thumbnail(box,Image.Resampling.LANCZOS);x=(W-fg.width)//2+int(3*math.sin(t*.3));y=360+(648-fg.height)//2+int(5*math.sin(t*.16))
    d=ImageDraw.Draw(bg);d.rounded_rectangle((x-5,y-5,x+fg.width+5,y+fg.height+5),radius=4,fill='#d2c5a5');bg.alpha_composite(fg.convert('RGBA'),(x,y));return bg
cues=[];words=timing['words']
for i in range(0,len(words),6):
    a=words[i:i+6];cues.append((a[0]['start']+.5,a[-1]['end']+.55,' '.join(w['text'] for w in a)))
stages=[0,duration*.40,duration*.69]
ffmpeg=imageio_ffmpeg.get_ffmpeg_exe();proc=subprocess.Popen([ffmpeg,'-y','-f','rawvideo','-vcodec','rawvideo','-s',f'{W}x{H}','-pix_fmt','rgb24','-r',str(FPS),'-i','-','-i',str(root/'narration.wav'),'-filter_complex','[1:a]adelay=500|500,apad[a]','-map','0:v','-map','[a]','-t',str(duration),'-vf','scale=1080:1920:flags=lanczos,format=yuv420p','-c:v','libx264','-preset','fast','-crf','19','-c:a','aac','-b:a','192k','-movflags','+faststart',str(root/'reel.mp4')],stdin=subprocess.PIPE,stdout=subprocess.DEVNULL,stderr=(root/'render.log').open('w'))
for frame in range(math.ceil(duration*FPS)):
    t=frame/FPS;idx=min(len(images)-1,sum(t>=s for s in stages)-1);im=frame_of(idx,t)
    if idx>0 and t<stages[idx]+.8:im=Image.blend(frame_of(idx-1,t),im,(t-stages[idx])/.8)
    d=ImageDraw.Draw(im);d.text((36,36),'GANYAN ZEKÂSI  /  HİPODROM HİKÂYELERİ',font=font(20),fill='#e7d2a6')
    d.text((36,102),ep['venueLabel'].replace(' Hipodromu','').upper(),font=font(34),fill='#a3d9c4')
    for i,line in enumerate(wrap(d,ep['title'],font(40),645)[:2]):d.text((36,161+i*49),line,font=font(40),fill='#fff1d7')
    d.text((36,285),'1993 → 1994 → 2014' if ep['id'].startswith('wolverhampton-1993') else str(ep['year']),font=font(31),fill='#dcc194')
    asset=assets[idx];label=f"GERÇEK HİPODROM FOTOĞRAFI · {asset.get('date','')[:10]}"
    d.text((36,1003),label,font=font(17),fill='#d6c59f');d.text((36,1030),asset['author']+' · '+asset['license'],font=font(16),fill='#aabdb8')
    cue=next((c[2] for c in cues if c[0]<=t<c[1]),'')
    for i,line in enumerate(wrap(d,cue,font(28),640)[:3]):d.text((W//2,1080+i*39),line,font=font(28),anchor='mt',fill='#fff6e6')
    d.text((36,1213),'ÇEKİM TARİHLERİ BELİRTİLMİŞTİR · AÇILIŞ ANI GÖRÜNTÜSÜ DEĞİLDİR',font=font(12),fill='#9bb4b2')
    d.line((36,1250,36+648*t/duration,1250),fill='#d6bb86',width=3)
    if frame==12:im.convert('RGB').save(root/'cover.jpg',quality=95)
    if frame in [int(FPS*duration*.5),int(FPS*duration*.8)]:im.convert('RGB').save(root/f'archive-qa-{frame}.jpg',quality=94)
    proc.stdin.write(im.convert('RGB').tobytes())
proc.stdin.close()
if proc.wait()!=0:raise RuntimeError('archive_render_failed')
(root/'render-report.json').write_text(json.dumps({'duration':duration,'fps':FPS,'frames':frame+1,'voiceStyle':timing['voiceStyle'],'visualStyle':'real-venue-archive-v1','local':True,'assetRights':[{'source':a['source'],'license':a['license'],'author':a['author'],'date':a['date']} for a in assets]},ensure_ascii=False),encoding='utf-8')
