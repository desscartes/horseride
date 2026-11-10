from pathlib import Path
import json,subprocess,hashlib,wave
import imageio_ffmpeg
root=Path(r'D:\Apps\HorseRide\data\instagram\history-chantilly-2013-treve-preview')
ff=imageio_ffmpeg.get_ffmpeg_exe()
with wave.open(str(root/'narration.wav')) as a:duration=a.getnframes()/a.getframerate()
# Distinct source time ranges from the same explicitly CC-licensed documentary.
# The archive date is visible throughout; these are not represented as 2013/2014 Arc finishes.
shots=[(114,2.0),(6,6.0),(100,5.0),(12,5.0),(165,8.0),(106,duration-25.5)]
files=[]
for i,(start,length) in enumerate(shots):
 output=root/f'edit-shot-{i}.mp4'
 filt='split[b][f];[b]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,gblur=sigma=35,eq=brightness=-0.25:saturation=0.65[bg];[f]scale=960:-2,crop=720:540,eq=contrast=1.035:saturation=0.9[fg];[bg][fg]overlay=0:330,setsar=1,fps=24,format=yuv420p'
 subprocess.run([ff,'-y','-v','error','-ss',str(start),'-t',str(length),'-i',str(root/'source-2014.mp4'),'-filter_complex',filt,'-an','-c:v','libx264','-preset','fast','-crf','18','-threads','2',str(output)],check=True,timeout=120)
 files.append(output)
(root/'edit-list.txt').write_text('\n'.join("file '"+p.name+"'" for p in files),encoding='utf-8')
def stamp(t):return f'0:{int(t)//60:02d}:{t%60:05.2f}'
lines=['[Script Info]','ScriptType: v4.00+','PlayResX: 720','PlayResY: 1280','[V4+ Styles]',
'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
'Style: Main,Georgia,50,&H00EFF3F6,&H00FFFFFF,&H90101922,&H00000000,-1,0,0,0,100,100,0,0,1,1,1,8,48,48,150,1',
'Style: Fact,Segoe UI Semibold,37,&H00E8DBB4,&H00FFFFFF,&H90101922,&H00000000,0,0,0,0,100,100,0,0,1,1,1,2,48,48,240,1',
'Style: Credit,Segoe UI,19,&H00D6DEE5,&H00FFFFFF,&H90101922,&H00000000,0,0,0,0,100,100,0,0,1,1,0,2,36,36,55,1',
'[Events]','Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
f'Dialogue: 0,0:00:00.00,{stamp(duration)},Credit,,0,0,0,,Arşiv: Prix Ganay 2014 · France Sire · CC BY 3.0',
f'Dialogue: 0,0:00:00.00,{stamp(duration)},Main,,0,0,0,,TRÊVE\\N'+r'{\fs30}Satış ringinden yarış tarihine']
facts=[(0,8,'CHANTILLY · BİR GERİ DÖNÜŞ HİKÂYESİ'),(8,14,'2011 · TEKLİF 22.000 €\\NSatış gerçekleşmedi'),(14,20,'2013 · DIANE VE ARC'),(20,26,'2014 · İLK ÜÇ STARTTA GALİBİYET YOK'),(26,duration,'ÜST ÜSTE İKİ ARC ZAFERİ')]
for start,end,text in facts:lines.append(f'Dialogue: 1,{stamp(start)},{stamp(min(end,duration))},Fact,,0,0,0,,'+r'{\fad(130,130)}'+text)
(root/'documentary.ass').write_text('\n'.join(lines),encoding='utf-8-sig')
output=root/'treve-documentary-preview.mp4'
subprocess.run([ff,'-y','-v','error','-f','concat','-safe','0','-i',str(root/'edit-list.txt'),'-i',str(root/'narration.wav'),'-vf','subtitles=documentary.ass','-map','0:v:0','-map','1:a:0','-af','loudnorm=I=-16:TP=-1.5:LRA=11','-t',str(duration),'-c:v','libx264','-preset','fast','-crf','18','-threads','2','-c:a','aac','-b:a','160k','-movflags','+faststart',str(output)],check=True,timeout=240,cwd=root)
stream=imageio_ffmpeg.read_frames(str(output),output_params=['-vf','scale=180:320']);meta=next(stream);count=black=0
for count,frame in enumerate(stream,1):
 if max(frame)<=1:black+=1
assert not black and abs(count/meta['fps']-duration)<.2
report={'status':'preview_only','duration':duration,'frames':count,'blackFrames':black,'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'publishing':False,'source':'https://www.youtube.com/watch?v=5SojXKz8sjs','sourceAuthor':'France Sire','license':'Creative Commons Attribution 3.0; explicitly shown on source page','archiveDate':'2014-04-27','sourceAudioUsed':False,'generativeAnatomy':False,'storySources':json.loads((root/'episode.json').read_text(encoding='utf-8'))['sources'],'voice':'tr-TR-AhmetNeural','comparisonBaseline':'approved Fio Rito visual-v7 / native-v6; sample requires quality comparison, technical checks alone do not approve publication'}
(root/'documentary-preview-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(report,ensure_ascii=False))
