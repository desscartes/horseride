"""Unattended local history renderer: approved motion library + native Turkish F0 voice."""
from pathlib import Path
import argparse,ctypes,hashlib,json,math,os,re,subprocess,time,wave
from xml.sax.saxutils import escape,quoteattr
import imageio_ffmpeg
import numpy as np

APP=Path(os.environ.get('HORSERIDE_APP_ROOT','D:/Apps/HorseRide')).resolve()
DATA=APP/'data'/'instagram'
ROOT=DATA/'native-renderer'
def read(path):return json.loads(Path(path).read_text(encoding='utf-8-sig'))
def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def atomic(path,value):
    path=Path(path); temp=path.with_name(path.name+f'.{os.getpid()}.tmp')
    temp.write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8')
    os.replace(temp,path)
def run(command,log,timeout=300):
    with Path(log).open('w',encoding='utf-8') as output:
        subprocess.run(command,stdout=output,stderr=subprocess.STDOUT,check=True,timeout=timeout,
            creationflags=subprocess.CREATE_NO_WINDOW|subprocess.BELOW_NORMAL_PRIORITY_CLASS)
def tighten(source,target):
    with wave.open(str(source)) as audio:
        assert audio.getnchannels()==1 and audio.getsampwidth()==2
        rate=audio.getframerate(); pcm=np.frombuffer(audio.readframes(audio.getnframes()),dtype='<i2').copy()
    assert len(pcm)>rate and np.abs(pcm.astype(np.int32)).max()>100
    block=round(rate*.01); floats=pcm[:len(pcm)//block*block].astype(float).reshape(-1,block)/32768
    quiet=np.sqrt((floats*floats).mean(axis=1))<.0032
    intervals=[]; start=None
    for i,q in enumerate(list(quiet)+[False]):
        if q and start is None:start=i
        elif not q and start is not None:intervals.append((start*block,min(i*block,len(pcm))));start=None
    cuts=[]
    for a,b in intervals:
        if a==0 and b-a>rate*.10:cuts.append((0,b-round(rate*.10)))
        elif b>=len(floats)*block and b-a>rate*.18:cuts.append((a+round(rate*.18),len(pcm)))
        elif b-a>=rate*.32:cuts.append((a+round(rate*.14),b-round(rate*.14)))
    parts=[]; cursor=0
    for a,b in cuts:parts.append(pcm[cursor:a]);cursor=b
    parts.append(pcm[cursor:]); result=np.concatenate(parts)
    assert len(result)>.65*len(pcm),'Silence detection requires review'
    with wave.open(str(target),'wb') as out:
        out.setparams((1,2,rate,0,'NONE','not compressed'));out.writeframes(result.astype('<i2').tobytes())
    return {'rawSeconds':len(pcm)/rate,'seconds':len(result)/rate,'removedSeconds':(len(pcm)-len(result))/rate,
        'pauseTarget':.28,'speechRateChanged':False,'pitchChanged':False}
def ass_escape(text):return str(text).replace('\\','／').replace('{','（').replace('}','）').replace('\n',' ').strip()
def stamp(t):
    t=round(t*100);h,t=divmod(t,360000);m,t=divmod(t,6000);s,cs=divmod(t,100)
    return f'{h}:{m:02}:{s:02}.{cs:02}'

parser=argparse.ArgumentParser();parser.add_argument('directory',type=Path);parser.add_argument('--day',required=True);parser.add_argument('--voice-only',action='store_true')
args=parser.parse_args();directory=args.directory.resolve();directory.relative_to(DATA)
ep=read(directory/'episode.json');assert ep.get('reviewed') is True and ep.get('sources')
text=(directory/'narration.txt').read_text(encoding='utf-8').strip()
assert text and len(text)<3500 and ep.get('narration')==text
LIBROOT=ROOT/'episodes'/ep['id']
if not (LIBROOT/'motion-library.json').exists():LIBROOT=ROOT
library=read(LIBROOT/'motion-library.json')
assert library['version']=='reviewed-motion-v7'
helper=APP/'server'/'history-native'/'azure-voice.ps1';policy=ROOT/'azure-policy.json'
ps='C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe'
base=[ps,'-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',str(helper),'-PolicyPath',str(policy),'-NarrationDay',args.day]
selected=subprocess.run([*base,'-DescribeVoice'],capture_output=True,text=True,encoding='utf-8-sig',check=True,timeout=30,creationflags=subprocess.CREATE_NO_WINDOW)
voice= json.loads(selected.stdout)
assert voice['voice'] in ('tr-TR-AhmetNeural','tr-TR-EmelNeural')
aliases=read(ROOT/'pronunciations.json');aliases.update(ep.get('pronunciations',{}))
pattern=re.compile(r'(?<!\w)(?:'+'|'.join(re.escape(k) for k in sorted(aliases,key=len,reverse=True))+r')(?!\w)',re.IGNORECASE) if aliases else None
lookup={k.casefold():v for k,v in aliases.items()}
pieces=[];cursor=0
for match in pattern.finditer(text) if pattern else []:
    pieces.append(escape(text[cursor:match.start()]));pieces.append('<sub alias='+quoteattr(lookup[match.group().casefold()])+'>'+escape(match.group())+'</sub>');cursor=match.end()
pieces.append(escape(text[cursor:]))
ssml='<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="tr-TR"><voice name='+quoteattr(voice['voice'])+'><prosody rate="+3%">'+''.join(pieces)+'</prosody></voice></speak>'
voice_key=hashlib.sha256((args.day+ssml).encode()).hexdigest()
asset_paths={}
for role,asset in library['clips'].items():
    path=(LIBROOT/asset['file']).resolve();path.relative_to(LIBROOT)
    assert sha(path)==asset['sha256'],'Motion library checksum mismatch: '+role
    asset_paths[role]=path
stable_episode={k:ep.get(k) for k in ('id','title','year','series','countryLabel','venueLabel','screenFacts','sources')}
render_key=hashlib.sha256(json.dumps({'voiceKey':voice_key,'library':library,'episode':stable_episode,
    'code':sha(Path(__file__))},sort_keys=True,ensure_ascii=False).encode()).hexdigest()

# OS-owned mutex releases on process/PC failure and works across interactive
# and scheduled sessions. Stale PID files cannot prevent restart recovery.
kernel=ctypes.WinDLL('kernel32',use_last_error=True)
kernel.CreateMutexW.argtypes=[ctypes.c_void_p,ctypes.c_bool,ctypes.c_wchar_p];kernel.CreateMutexW.restype=ctypes.c_void_p
kernel.WaitForSingleObject.argtypes=[ctypes.c_void_p,ctypes.c_uint32];kernel.WaitForSingleObject.restype=ctypes.c_uint32
kernel.ReleaseMutex.argtypes=[ctypes.c_void_p];kernel.CloseHandle.argtypes=[ctypes.c_void_p]
mutex=kernel.CreateMutexW(None,False,'Global\\HorseRideHistoryRender-'+hashlib.sha256(str(directory).encode()).hexdigest()[:20])
if not mutex:raise ctypes.WinError(ctypes.get_last_error())
wait=kernel.WaitForSingleObject(mutex,0)
if wait not in (0,128):kernel.CloseHandle(mutex);raise RuntimeError('Render already active or unavailable')
state={'day':args.day,'pid':os.getpid(),'renderKey':render_key,'voice':voice,'codexRequired':False,'startedAt':time.time()}
def status(phase,**extra):state.update(phase=phase,updatedAt=time.time(),**extra);atomic(directory/'production-state.json',state)
try:
    prior=read(directory/'render-report.json') if (directory/'render-report.json').exists() else {}
    movie=directory/'reel.mp4'
    if prior.get('renderKey')==render_key and movie.exists() and sha(movie)==prior.get('sha256') and sha(directory/'cover.jpg')==prior.get('coverSha256'):
        status('reused_verified');print(json.dumps({'status':'reused_verified','voice':voice}));raise SystemExit(0)
    status('narrating')
    raw=directory/'narration-raw.wav';source_meta=directory/'voice-source.json'
    cached=read(source_meta) if source_meta.exists() else {}
    if not (cached.get('voiceKey')==voice_key and raw.exists() and sha(raw)==cached.get('sha256')):
        ssml_path=directory/'narration.ssml';ssml_path.write_text(ssml,encoding='utf-8')
        temporary=directory/'narration-raw.tmp.wav'
        run([*base,'-SsmlPath',str(ssml_path),'-OutputPath',str(temporary)],directory/'speech.log',120)
        with wave.open(str(temporary)) as check:assert check.getnframes()>check.getframerate()
        os.replace(temporary,raw);atomic(source_meta,{'voiceKey':voice_key,'voice':voice,'sha256':sha(raw)})
    audio=directory/'narration.wav';pause=tighten(raw,audio);duration=pause['seconds']
    assert 8<duration<120,'Narration length outside the unattended format'
    status('audio_ready',duration=duration,pause=pause)
    if args.voice_only:
        atomic(directory/'voice-preview-report.json',{'duration':duration,'voice':voice,'pause':pause,'date':args.day,'voiceKey':voice_key,'codexRequired':False,'publishing':False})
        print(json.dumps({'status':'voice_ready','duration':duration,'voice':voice,'publishing':False}));raise SystemExit(0)
    assert library.get('reviewed') is True,'Motion library requires actual visual review'
    count=max(4,math.ceil(duration/7.8));cross=.12;length=(duration+cross*(count-1))/count
    assert length<8
    roles=list(asset_paths)
    assert count<=len(roles),'Distinct scene stock is too short for this narration; more scenes required'
    assert all(length <= library['clips'][role].get('duration',8.125)-.05 for role in roles[:count]),'A scene is too short; create longer motion, never loop or freeze it'
    rotation=int(hashlib.sha256(ep['id'].encode()).hexdigest()[:6],16)
    ffmpeg=imageio_ffmpeg.get_ffmpeg_exe();inputs=[]
    for i in range(count):
        role=roles[i%len(roles)];scene_duration=library['clips'][role].get('duration',8.125)
        start=((rotation+i*173)%1000)/1000*max(0,scene_duration-length-.05)
        inputs+=['-ss',str(start),'-t',str(length),'-i',str(asset_paths[role])]
    inputs+=['-i',str(audio)]
    title=ass_escape(ep['title']);title='\\N'.join(__import__('textwrap').wrap(title,27))
    lines=['[Script Info]','ScriptType: v4.00+','PlayResX: 720','PlayResY: 1280','',
        '[V4+ Styles]',
        'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
        'Style: Title,Georgia,50,&H00E4EFF6,&H00FFFFFF,&H90111A1E,&H00000000,-1,0,0,0,100,100,0,0,1,1.6,1,8,45,45,145,1',
        'Style: Fact,Segoe UI Semibold,33,&H00F4F5F6,&H00FFFFFF,&H90111A1E,&H00000000,-1,0,0,0,100,100,0,0,1,1.8,1,8,40,40,145,1',
        'Style: Series,Segoe UI,22,&H00C5D6DE,&H00FFFFFF,&H90111A1E,&H00000000,0,0,0,0,100,100,1,0,1,1,0,8,36,36,62,1',
        'Style: Small,Segoe UI,18,&H00D6DADD,&H00FFFFFF,&H90111A1E,&H00000000,0,0,0,0,100,100,0,0,1,1,0,9,30,30,32,1','',
        '[Events]','Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
        f'Dialogue: 0,0:00:00.00,{stamp(duration)},Small,,0,0,0,,Temsili görüntü',
        f'Dialogue: 0,0:00:00.20,{stamp(min(length-.15,6))},Series,,0,0,0,,'+ass_escape(('GAZİ KOŞUSU TARİHİ' if ep['series']=='gazi' else 'HİPODROMUN HAFIZASI')+' · '+str(ep['year'])),
        f'Dialogue: 1,0:00:00.45,{stamp(min(length-.15,6))},Title,,0,0,0,,'+r'{\fad(200,200)}'+title]
    facts=ep.get('screenFacts') or [str(ep['year']),ep.get('venueLabel') or ep.get('countryLabel','')]
    facts=[f for f in facts if f and len(f)<90][:5]
    for i,fact in enumerate(facts):
        start=(i+1)*(length-cross)+.3
        if start>duration-2:break
        stop=min(duration-.3,start+min(length-.7,5.5))
        lines.append(f'Dialogue: 1,{stamp(start)},{stamp(stop)},Fact,,0,0,0,,'+r'{\fad(180,180)}'+ass_escape(fact))
    (directory/'titles.ass').write_text('\n'.join(lines),encoding='utf-8-sig')
    filters=[f'[{i}:v]setsar=1,settb=AVTB,setpts=PTS-STARTPTS,fps=24,format=yuv420p[v{i}]' for i in range(count)]
    previous='v0'
    for i in range(1,count):
        target=f'x{i}';filters.append(f'[{previous}][v{i}]xfade=transition=fade:duration={cross}:offset={i*(length-cross):.6f},fps=24[{target}]');previous=target
    filters += [f'[{previous}]trim=duration={duration},subtitles=titles.ass,fade=t=in:d=0.22,fade=t=out:st={duration-.4}:d=0.4,format=yuv420p[v]',
        f'[{count}:a]loudnorm=I=-16:TP=-1.5:LRA=11[a]']
    status('rendering')
    output=directory/'reel.tmp.mp4'
    with (directory/'render.log').open('w') as log:
        subprocess.run([ffmpeg,'-hide_banner','-y',*inputs,'-filter_complex_threads','1','-filter_complex',';'.join(filters),
            '-map','[v]','-map','[a]','-t',str(duration),'-c:v','libx264','-threads','2','-preset','fast','-crf','18',
            '-c:a','aac','-b:a','160k','-ar','48000','-movflags','+faststart',str(output)],cwd=directory,
            stdout=subprocess.DEVNULL,stderr=log,check=True,timeout=420,creationflags=subprocess.CREATE_NO_WINDOW|subprocess.BELOW_NORMAL_PRIORITY_CLASS)
    status('verifying')
    # Decode every frame at reduced resolution. No generated leg poses are used.
    stream=imageio_ffmpeg.read_frames(str(output),output_params=['-vf','scale=180:320'])
    metadata=next(stream);frames=black=0
    for frames,frame in enumerate(stream,start=1):
        seconds=(frames-1)/metadata['fps']
        if .75<seconds<duration-.75 and max(frame)<=1:black+=1
    assert frames and not black and abs(frames/metadata['fps']-duration)<.16
    audio_check=subprocess.run([ffmpeg,'-v','error','-i',str(output),'-map','0:a:0','-f','f32le','-ar','16000','-ac','1','pipe:1'],capture_output=True,check=True,timeout=60,creationflags=subprocess.CREATE_NO_WINDOW)
    samples=np.frombuffer(audio_check.stdout,dtype='<f4')
    assert len(samples) and np.isfinite(samples).all() and np.abs(samples).max()>.01 and abs(len(samples)/16000-duration)<.18
    run([ffmpeg,'-hide_banner','-y','-ss','1','-i',str(output),'-frames:v','1',str(directory/'cover.jpg')],directory/'cover.log',60)
    os.replace(output,movie)
    result={'duration':duration,'fps':24,'frames':frames,'voiceStyle':'native-tr-flow-v6','visualStyle':'reviewed-motion-v7',
        'rendererVersion':'local-native-motion-v1','renderKey':render_key,'sha256':sha(movie),'coverSha256':sha(directory/'cover.jpg'),
        'voice':voice,'pause':pause,'date':args.day,'codexRequired':False,'localRender':True,'speechProvider':'Azure Speech F0',
        'motionMode':'approved_cached_motion_library','newGenerativeFrames':False,'opticalFlowForLegs':False,
        'disclosure':library['disclosure'],'credits':library['credits'],'sourceUrls':ep['sources'],'blackFrames':black,
        'audioDecodedSeconds':len(samples)/16000,'finishedAt':time.time()}
    atomic(directory/'render-report.json',result)
    status('rendered',sha256=result['sha256']);print(json.dumps({'status':'rendered','directory':str(directory),'voice':voice,'duration':duration}))
except SystemExit:raise
except BaseException as error:
    status('failed',error=f'{type(error).__name__}: {str(error)[:180]}');raise
finally:kernel.ReleaseMutex(mutex);kernel.CloseHandle(mutex)
