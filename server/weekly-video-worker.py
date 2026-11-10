"""Local weekly motion stock. No Instagram tokens, Codex, or paid inference calls."""
from pathlib import Path
import argparse,json,os,hashlib,subprocess,time,datetime,shutil,ctypes
ROOT=Path('D:/Apps/HorseRide');RUNTIME=ROOT/'video-runtime';DATA=ROOT/'data/instagram';STOCK=DATA/'weekly-stock'
runtime_config=ROOT/'data/maintenance/video-runtime-config.json'
if runtime_config.exists():
 config=json.loads(runtime_config.read_text(encoding='utf-8-sig'))
 if config.get('enabled'):
  candidate=Path(config['path']).resolve()
  if candidate not in (RUNTIME.resolve(),Path('C:/Users/desscartes/AppData/Local/HorseRide/video-runtime').resolve(),Path('C:/Users/desscartes/HorseRideVideoRuntime').resolve()):raise RuntimeError('Unexpected application runtime path')
  if json.loads((candidate/'cache-marker.json').read_text(encoding='utf-8-sig')).get('status')!='verified':raise RuntimeError('Video cache not verified')
  RUNTIME=candidate
PYTHON=RUNTIME/'.venv/Scripts/python.exe';FFMPEG=None
SERVICE=Path(__file__).resolve().parent
def read(p):return json.loads(Path(p).read_text(encoding='utf-8-sig'))
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def atomic(p,v):
 p=Path(p);p.parent.mkdir(parents=True,exist_ok=True);tmp=p.with_name(p.name+'.tmp');tmp.write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8');os.replace(tmp,p)
def execute(args,log,timeout=7200):
 log.parent.mkdir(parents=True,exist_ok=True)
 with log.open('a',encoding='utf-8') as out:
  with subprocess.Popen([str(a) for a in args],stdout=out,stderr=subprocess.STDOUT,creationflags=subprocess.CREATE_NO_WINDOW|subprocess.BELOW_NORMAL_PRIORITY_CLASS) as child:
   try:code=child.wait(timeout=timeout)
   except subprocess.TimeoutExpired as error:
    # Venv python.exe is a launcher: kill only this owned tree, not just its root.
    if child.poll() is None:subprocess.run(['taskkill.exe','/PID',str(child.pid),'/T','/F'],stdout=out,stderr=subprocess.STDOUT,check=False,timeout=30,creationflags=subprocess.CREATE_NO_WINDOW)
    child.wait(timeout=30)
    raise RuntimeError(f'Local generation timed out after {timeout}s; log={log}') from error
   if code:
    out.flush();tail=log.read_text(encoding='utf-8',errors='replace')[-2000:]
    raise RuntimeError(f'Local generation exit {code}; log={log}; {tail}')
def turkey_now():return datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=3)))
def week_id(now):
 day=now.date();monday=day-datetime.timedelta(days=day.weekday())
 if day.weekday()>=5:monday+=datetime.timedelta(days=7)
 return monday.isoformat()
p=argparse.ArgumentParser();p.add_argument('--probe',action='store_true');p.add_argument('--episode');p.add_argument('--scene-count',type=int,choices=(4,8),default=8);p.add_argument('--motion-frames',type=int,choices=(49,65),default=65);a=p.parse_args()
if a.scene_count!=8 and not a.episode:p.error('A short draft must name a single episode')
if a.motion_frames!=65 and not a.episode:p.error('Short motion must name a single episode')
STOCK.mkdir(parents=True,exist_ok=True)
import sys
sys.path.insert(0,str(RUNTIME))
from lab_state import acquire,release,atomic_json
lock=RUNTIME/'weekly-worker.lock';acquire(lock,'weekly-video-worker.py')
state={'status':'starting','startedAt':turkey_now().isoformat(),'pid':os.getpid(),'publishing':False,'codexRequired':False,'paidInference':False}
def status(phase,**extra):state.update(status=phase,updatedAt=turkey_now().isoformat(),**extra);atomic(STOCK/'status.json',state)
try:
 status('loading_cuda_runtime')
 import torch
 import imageio_ffmpeg
 FFMPEG=imageio_ffmpeg.get_ffmpeg_exe()
 if not torch.cuda.is_available():raise RuntimeError('CUDA unavailable in task account')
 x=torch.tensor([2.0],device='cuda');assert (x*x).item()==4;del x;torch.cuda.empty_cache()
 identity=subprocess.check_output(['whoami','/user','/fo','csv','/nh'],creationflags=subprocess.CREATE_NO_WINDOW).decode(errors='replace')
 atomic(ROOT/'data/maintenance/weekly-video-gpu-probe.json',{'status':'passed','device':torch.cuda.get_device_name(0),'checkedAt':turkey_now().isoformat(),'systemAccount':'S-1-5-18' in identity,'codexRequired':False})
 if not (RUNTIME/'sd15/verified-model.json').exists():raise RuntimeError('Local first-frame model download is not complete')
 catalog=read(DATA/'history-catalog.json')['episodes'];used=set()
 for d in DATA.glob('history-*/publication.json'):
  try:
   pub=read(d)
   if pub.get('status')=='published_verified':used.add(d.parent.name.removeprefix('history-'))
  except (OSError,ValueError):pass
 used.add('gazi-1927')
 ledger=read(DATA/'gazi-series/ledger.json');next_gazi=max([e['year'] for e in ledger['episodes'] if e.get('status')=='published_verified']+[1926])+1
 candidates=[e for e in catalog if e.get('reviewed') and e.get('sources') and e['id'] not in used and (e.get('interestingStory') or e.get('series')=='gazi' and e.get('year')==next_gazi)]
 candidates.sort(key=lambda e:(0 if e.get('series')=='gazi' else 1,-e.get('interestScore',0),e['id']))
 week=week_id(turkey_now());folder=STOCK/week;folder.mkdir(exist_ok=True);plan_path=folder/'plan.json'
 if plan_path.exists():
  plan=read(plan_path)
  # Published episodes cannot occupy next week's production slots.
  eligible={e['id']:e for e in candidates}
  retained=[eligible[e['id']] for e in plan['episodes'] if e['id'] in eligible]
  retained_ids={e['id'] for e in retained}
  retained.extend(e for e in candidates if e['id'] not in retained_ids)
  plan={**plan,'episodes':retained[:7],'shortage':max(0,7-len(retained))}
  atomic(plan_path,plan)
 else:
  plan={'week':week,'targetEpisodes':7,'episodes':candidates[:7],'shortage':max(0,7-len(candidates)),'publishing':False};atomic(plan_path,plan)
 state['week']=week;state['planned']=len(plan['episodes']);state['sourceShortage']=plan['shortage']
 # A short, real GPU example validates the pipeline before the full weekly workload.
 episodes=plan['episodes']
 if a.episode:
  episodes=[e for e in candidates if e['id']==a.episode]
  if not episodes:raise RuntimeError('Requested story is not an unused reviewed catalog entry')
 else:
  daily_path=DATA/'history-days'/(turkey_now().date().isoformat()+'.json')
  chosen=read(daily_path).get('id') if daily_path.exists() else None
  episodes=sorted(episodes,key=lambda e:0 if e['id']==chosen else 1)
 if a.probe:episodes=episodes[:1]
 for ep in episodes:
  import re
  if not re.fullmatch(r'[a-z0-9-]{1,90}',ep['id']):raise RuntimeError('Invalid story identifier')
  if ep['id'] in used:status('already_published_skip',episode=ep['id']);continue
  direction_file=DATA/'native-renderer/motion-directions'/(ep['id']+'.json')
  directions=read(direction_file) if direction_file.exists() else {}
  direction_hash=hashlib.sha256(json.dumps(directions,sort_keys=True).encode()).hexdigest() if directions else None
  existing=DATA/'native-renderer/episodes'/ep['id']/'motion-library.json'
  if not a.probe and existing.exists():
   saved=read(existing)
   if saved.get('method')=='weekly-original-v2' and saved.get('motionDirectionHash')==direction_hash and len(saved.get('clips',{}))>=a.scene_count and all((existing.parent/c['file']).is_file() and sha(existing.parent/c['file'])==c['sha256'] for c in saved['clips'].values()):
    status('reusing_complete_episode_stock',episode=ep['id']);continue
  episode_root=RUNTIME/'weekly-jobs'/week/ep['id'];episode_root.mkdir(parents=True,exist_ok=True)
  segments=ep.get('storySegments') or ep.get('narrationSegments') or []
  narration=' '.join(s['text'] for s in segments) or ep.get('narration','')
  atomic(episode_root/'episode.json',{**ep,'narration':narration})
  roles=['portrait'] if a.probe else ['portrait','gait','infield','rail','detail','establishing','memory','closing'][:a.scene_count]
  country={'TR':'Turkey','US':'United States','GB':'England','FR':'France','CL':'Chile','AR':'Argentina'}.get(ep.get('country'),ep.get('countryLabel') or 'historic racecourse')
  motifs={
   'portrait':'a quiet close view of a horse head and neck beside a saddle, no legs visible, no recognizable person',
   'gait':'a close still life of a vintage leather racing saddle and racing silks at a stable doorway, moving dust and soft sunlight, no animals or people',
   'infield':'an empty racecourse infield and period grandstand, layered foreground grass, white rail, distant trees, no people or animals',
   'rail':'a low view along a different curved racecourse rail toward an empty grandstand, drifting clouds and warm light, no people or animals'}
  plans_path=DATA/'weekly-scene-plans.json'
  if plans_path.exists():motifs.update(read(plans_path).get(ep['id'],{}))
  motifs.update({'detail':'a different macro composition: '+motifs['gait'],'establishing':'a wide establishing composition: '+motifs['infield'],
   'memory':'an intimate cinematic detail composition with changing soft light: '+motifs['portrait'],'closing':'a different final perspective, quiet evening atmosphere: '+motifs['rail']})
  clips={}
  source_folder=DATA/'native-renderer/source-images'/ep['id']
  source_manifest=source_folder/'frame-sources.json'
  references=read(source_manifest).get('scenes',{}) if source_manifest.exists() else {}
  reference_credits=[];reference_disclosures=[]
  for index,role in enumerate(roles):
   reference=references.get(role)
   if reference:
    source_image=(source_folder/reference['file']).resolve();source_image.relative_to(source_folder.resolve())
    if reference.get('license') not in ('CC BY 2.0','CC BY 3.0','CC BY 4.0','CC0','Pexels') or not all(reference.get(k) for k in ('author','licenseUrl','sourceUrl','sourceId','sha256','disclosure')):raise RuntimeError('Reference image lacks verified attribution/license provenance')
    if sha(source_image)!=reference['sha256']:raise RuntimeError('Curated reference image hash changed')
   direction=directions.get(role,{})
   key=hashlib.sha256((ep['id']+role+motifs[role]+(reference['sha256'] if reference else '')+'weekly-original-v2'+(json.dumps(direction,sort_keys=True) if direction else '')).encode()).hexdigest();seed=int(key[:8],16)%2147483647
   job=episode_root/(role+'-'+key[:10]+('-probe' if a.probe else ''));job.mkdir(exist_ok=True)
   prompt=f"{ep['year']}, {country}. {direction.get('firstFrame', motifs[role])}. Historical illustration, vintage cinema, natural light, deep perspective. No text."
   (job/'first-frame-prompt.txt').write_text(prompt,encoding='utf-8')
   frame=job/'first-frame.png'
   frame_meta=frame.with_suffix('.json')
   frame_ready=False
   if frame.exists() and frame_meta.exists():
    prior_frame=read(frame_meta);frame_ready=prior_frame.get('sha256')==sha(frame) and prior_frame.get('prompt')==prompt
   if not frame_ready:
    if reference:
     from PIL import Image,ImageOps
     with Image.open(source_image) as image:ImageOps.fit(image.convert('RGB'),(288,512),centering=(.6,.6)).save(frame)
     atomic(frame_meta,{'sha256':sha(frame),'prompt':prompt,'reference':reference,'requiresVisualReview':True})
     status('using_verified_story_photograph',episode=ep['id'],scene=role)
    else:
     status('generating_original_frame',episode=ep['id'],scene=role)
     execute([PYTHON,SERVICE/'local-first-frame.py','--prompt-file',job/'first-frame-prompt.txt','--output',frame,'--seed',seed],job/'frame.log',1800)
   if reference:
    reference_credits.append(f"{reference['author']} / {reference['license']} {reference['licenseUrl']} / {reference['sourceUrl']} — kırpma ve hareketli uyarlama")
    reference_disclosures.append(reference['disclosure'])
   motion_prompt=f"A continuous smooth cinematic shot. {motifs[role]}. Subtle natural movement, slow camera parallax, stable anatomy and architecture. Preserve the composition and period atmosphere. No walking or galloping, no human face closeups, no text, no sudden cuts."
   motion_prompt=direction.get('positive',motion_prompt)
   negative_prompt=direction.get('negative','')
   (job/'motion-prompt.txt').write_text(motion_prompt,encoding='utf-8')
   if negative_prompt:(job/'negative-motion-prompt.txt').write_text(negative_prompt,encoding='utf-8')
   report=job/'status.json';movie=job/'motion-pilot.mp4'
   complete=False
   if report.exists() and movie.exists():
    prior=read(report)
    expected_signature={'image_sha256':sha(frame),'prompt':motion_prompt.strip(),'frames':17 if a.probe else a.motion_frames,'steps':12,'width':288,'height':512,'seed':seed,'playback_fps':8.0,'weight_revision':read(RUNTIME/'model-download.json')['revision'],'renderer_profile':'wan-i2v-fp32-protected-v2-bounded-attention'}
    if negative_prompt:expected_signature['negative_prompt']=negative_prompt.strip()
    expected_key=hashlib.sha256(json.dumps(expected_signature,sort_keys=True).encode()).hexdigest()
    complete=prior.get('status')=='rendered_pending_visual_review' and prior.get('video_sha256')==sha(movie) and prior.get('generation_key')==expected_key
   if not complete:
    status('animating_original_scene',episode=ep['id'],scene=role)
    extra=['--negative-prompt-file',job/'negative-motion-prompt.txt'] if negative_prompt else []
    execute([PYTHON,RUNTIME/'pilot_scene.py','--image',frame,'--prompt-file',job/'motion-prompt.txt','--output-dir',job,'--frames',17 if a.probe else a.motion_frames,'--steps',12,'--width',288,'--height',512,'--seed',seed,'--playback-fps',8,*extra],job/'motion.log')
   if a.probe:
    status('probe_rendered_pending_review',episode=ep['id'],preview=str(movie),frame=str(frame));break
   ready=DATA/'native-renderer/episodes'/ep['id'];ready.mkdir(parents=True,exist_ok=True);target=ready/(role+'.mp4')
   execute([FFMPEG,'-y','-i',movie,'-vf','scale=720:1280:flags=lanczos,fps=24','-an','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',target],job/'convert.log',300)
   clips[role]={'file':target.name,'sha256':sha(target),'duration':a.motion_frames/8,'sourceId':reference['sourceId'] if reference else 'original-local:'+key,'generationSource':str(movie),'license':reference['license'] if reference else 'Locally generated with pinned SD1.5 and Wan model manifests'}
  if not a.probe:
   atomic(ready/'motion-library.json',{'version':'reviewed-motion-v7','reviewed':False,'method':'weekly-original-v2','motionDirectionHash':direction_hash,'clips':clips,'disclosure':'Temsili özgün canlandırma; gerçek yarış veya olay arşivi değildir. '+' '.join(dict.fromkeys(reference_disclosures)),'credits':'Yerel SD1.5 / Wan canlandırması. '+'\n'.join(dict.fromkeys(reference_credits)),'sources':ep['sources']})
   atomic(folder/(ep['id']+'.json'),{'episode':ep['id'],'status':'rendered_pending_visual_review','library':str(ready/'motion-library.json'),'sources':ep['sources']})
 if not a.probe:status('episode_rendered_pending_review' if a.episode else 'batch_rendered_pending_review',prepared=len(episodes),scenesPerEpisode=a.scene_count)
except BaseException as error:
 status('failed',errorType=type(error).__name__,error=str(error)[-2000:]);raise
finally:release(lock)
