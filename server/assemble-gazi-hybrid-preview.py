"""Assemble only the new retake, offline, into a NON-PUBLISHING preview."""
from pathlib import Path
import hashlib,json,subprocess,wave,datetime,msvcrt
import imageio_ffmpeg
APP=Path('D:/Apps/HorseRide');OUT=APP/'data/instagram/history-gazi-1928-hybrid-v2'
LIB=APP/'data/instagram/native-renderer/episodes/gazi-1928'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def save(p,v):
 t=p.with_suffix(p.suffix+'.tmp');t.write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8');t.replace(p)
def main():
 if (OUT/'superseded-by-real-edit.json').exists():return
 if not (OUT/'narration.wav').exists():return
 direction=read(APP/'data/instagram/native-renderer/motion-directions/gazi-1928.json')
 expected=hashlib.sha256(json.dumps(direction,sort_keys=True).encode()).hexdigest()
 library=read(LIB/'motion-library.json')
 if library.get('motionDirectionHash')!=expected:
  save(OUT/'assembly-state.json',{'status':'waiting_for_new_motion_clips','publishing':False});return
 sources=[LIB/library['clips'][r]['file'] for r in ['infield','portrait','gait','rail']]
 for role,path in zip(['infield','portrait','gait','rail'],sources):
  if sha(path)!=library['clips'][role]['sha256']:raise RuntimeError('Scene checksum mismatch')
 licensed=OUT/'licensed-motion-source.mp4';assert sha(licensed)==read(OUT/'licensed-motion-source.json')['sha256']
 audio=OUT/'narration.wav'
 signature=hashlib.sha256((expected+sha(audio)+sha(licensed)+''.join(sha(p) for p in sources)).encode()).hexdigest()
 report=OUT/'hybrid-preview-report.json';target=OUT/'gazi-hybrid-preview.mp4'
 if report.exists() and target.exists() and read(report).get('signature')==signature and read(report).get('videoSha256')==sha(target):return
 with wave.open(str(audio)) as a:duration=a.getnframes()/a.getframerate()
 stock_length=3.;length=(duration-stock_length)/4
 assert 2<length<8,'Need more distinct scenes, never freeze or loop'
 ff=imageio_ffmpeg.get_ffmpeg_exe()
 save(OUT/'assembly-state.json',{'status':'assembling_preview','publishing':False})
 def run(args):
  with (OUT/'assembly.log').open('a',encoding='utf-8') as log:
   subprocess.run([ff,'-v','warning','-y',*map(str,args)],stdout=log,stderr=log,check=True,timeout=180,creationflags=subprocess.CREATE_NO_WINDOW|subprocess.BELOW_NORMAL_PRIORITY_CLASS)
 parts=[]
 # New generated action only; no old Gazi or Fio Rito footage is reused.
 ordered=[sources[0],sources[1],sources[2],licensed,sources[3]]
 for i,source in enumerate(ordered):
  part=OUT/f'hybrid-part-{i}.mp4';d=stock_length if source==licensed else length
  if source==licensed:
   # Whole natural movement stays geometrically unaltered. Film is labelled illustrative.
   vf='split[bg][fg];[bg]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,gblur=sigma=32[base];[fg]scale=720:-2[front];[base][front]overlay=(W-w)/2:(H-h)/2,eq=saturation=0.55:contrast=1.04:brightness=0.015,fps=24,setsar=1'
   seek=['-ss','0.7']
  else:
   vf='minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:vsbmc=1,scale=720:1280:flags=lanczos,eq=saturation=0.65:contrast=1.03,setsar=1';seek=[]
  run([*seek,'-i',source,'-t',str(d),'-vf',vf,'-an','-c:v','libx264','-threads','2','-preset','fast','-crf','18','-pix_fmt','yuv420p',part]);parts.append(part)
 listing=OUT/'hybrid-concat.txt';listing.write_text('\n'.join("file '"+p.as_posix()+"'" for p in parts),encoding='utf-8')
 ass=OUT/'hybrid-titles.ass'
 def stamp(t):
  n=round(t*100);h,n=divmod(n,360000);m,n=divmod(n,6000);s,c=divmod(n,100);return f'{h}:{m:02}:{s:02}.{c:02}'
 header='''[Script Info]
ScriptType: v4.00+
PlayResX: 720
PlayResY: 1280
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Main,Segoe UI,38,&H00FFFFFF,&H00FFFFFF,&H00202020,&H70000000,-1,0,0,0,100,100,0,0,1,2,0,8,45,45,130,1
Style: Note,Segoe UI,23,&H00FFFFFF,&H00FFFFFF,&H00202020,&H70000000,0,0,0,0,100,100,0,0,1,1,0,2,35,35,160,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
'''
 titles=[(0,4.5,'1928 · ANKARA'),(length,length+4,'GAZİ KOŞUSU · İKİNCİ BÖLÜM'),(length*2,length*2+4,'PRIMEROLE · ATIF BEY')]
 lines=[f'Dialogue: 0,{stamp(s)},{stamp(e)},Main,,0,0,0,,{t}' for s,e,t in titles]
 lines.append(f'Dialogue: 0,0:00:00.00,{stamp(duration)},Note,,0,0,0,,Temsili görüntüler · Tarihî yarış arşivi değildir')
 ass.write_text(header+'\n'.join(lines),encoding='utf-8')
 # relative subtitle path prevents Windows drive colon parsing; no shell execution.
 with (OUT/'assembly.log').open('a',encoding='utf-8') as log:
  subprocess.run([ff,'-v','warning','-y','-f','concat','-safe','0','-i',str(listing),'-i',str(audio),'-vf','subtitles=hybrid-titles.ass','-t',str(duration),'-c:v','libx264','-threads','2','-preset','fast','-crf','18','-c:a','aac','-b:a','192k','-movflags','+faststart',str(target)],cwd=OUT,stdout=log,stderr=log,check=True,timeout=180,creationflags=subprocess.CREATE_NO_WINDOW|subprocess.BELOW_NORMAL_PRIORITY_CLASS)
 subprocess.run([ff,'-v','error','-i',str(target),'-f','null','-'],check=True,capture_output=True,timeout=50)
 save(report,{'status':'preview_requires_actual_visual_and_audio_review','signature':signature,'videoSha256':sha(target),'duration':duration,'voice':read(OUT/'voice-source.json')['voice'],'publishing':False,'codexRequired':False,'newMotionDirectionHash':expected,'source':read(OUT/'licensed-motion-source.json'),'allGeneratedClipsReviewed':False})
 subprocess.run([str(APP/'.venv/Scripts/python.exe'),str(APP/'server/local-video-review.py'),'--video',str(target)],check=True,timeout=120)
 save(OUT/'assembly-state.json',{'status':'preview_ready_not_approved','file':str(target),'publishing':False})
if __name__=='__main__':
 if OUT.exists():
  lock=open(OUT/'assembly.lock','a+b');lock.seek(0);lock.write(b'0');lock.flush();lock.seek(0)
  try:msvcrt.locking(lock.fileno(),msvcrt.LK_NBLCK,1)
  except OSError:raise SystemExit(0)
  try:main()
  except Exception as e:
   save(OUT/'assembly-state.json',{'status':'assembly_failed','error':type(e).__name__+': '+str(e),'publishing':False});raise
  finally:lock.seek(0);msvcrt.locking(lock.fileno(),msvcrt.LK_UNLCK,1);lock.close()
