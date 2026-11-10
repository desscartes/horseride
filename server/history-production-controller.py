"""Local preview director for prepared, source-reviewed story packages. Never publishes."""
from pathlib import Path
import importlib.util,json,hashlib,subprocess,msvcrt,datetime
from history_daily_state import daily_state
import imageio_ffmpeg
APP=Path('D:/Apps/HorseRide');ROOT=APP/'data/instagram'
spec=importlib.util.spec_from_file_location('context_agent',APP/'server/history-context-agent.py');agent=importlib.util.module_from_spec(spec);spec.loader.exec_module(agent)
def render(directory,m):
 ff=imageio_ffmpeg.get_ffmpeg_exe();parts=[]
 def run(args):
  with (directory/'automatic-documentary-render.log').open('a',encoding='utf-8') as log:subprocess.run([ff,'-v','warning','-y',*map(str,args)],cwd=directory,stdout=log,stderr=log,check=True,timeout=180,creationflags=subprocess.CREATE_NO_WINDOW|subprocess.BELOW_NORMAL_PRIORITY_CLASS)
 for i,shot in enumerate(m['timeline']):
  a=m['assets'][shot['asset']];source=(directory/a['file']).resolve();source.relative_to(directory.resolve())
  if agent.sha(source)!=a['sha256']:raise ValueError('Source changed: re-curation needed')
  part=directory/f'automatic-shot-{i}.mp4';duration=shot['end']-shot['start'];still=source.suffix.lower() in ['.png','.jpg','.jpeg']
  args=['-loop','1'] if still else ['-ss',str(shot.get('sourceStart',0))]
  # Preserve geometry; contextual documentary fallback deliberately uses real stills/documents.
  vf="scale=1440:2560:force_original_aspect_ratio=decrease,pad=1440:2560:(ow-iw)/2:(oh-ih)/2:color=0x1a252b,zoompan=z='1.02+0.0005*on':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=720x1280:fps=24" if still else 'scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:color=0x1a252b,fps=24'
  run([*args,'-i',source,'-t',duration,'-vf',vf,'-an','-c:v','libx264','-threads','2','-preset','fast','-crf','18','-pix_fmt','yuv420p',part]);shot.update(renderedClip=part.name,clipSha256=agent.sha(part));parts.append(part)
 listing=directory/'automatic-concat.txt';listing.write_text('\n'.join("file '"+p.as_posix()+"'" for p in parts),encoding='utf-8')
 target=(directory/m['videoFile']).resolve();target.relative_to(directory.resolve())
 if not (directory/'titles.ass').exists():raise ValueError('Prepared factual labels/subtitles missing')
 run(['-f','concat','-safe','0','-i',listing,'-i',directory/'narration.wav','-vf','subtitles=titles.ass','-t',m['duration'],'-c:v','libx264','-threads','2','-preset','fast','-crf','18','-c:a','aac','-b:a','192k','-movflags','+faststart',target])
 m['videoSha256']=agent.sha(target);m['voiceSha256']=agent.sha(directory/'narration.wav');m['narrationSha256']=agent.sha(directory/'narration.txt');agent.atomic(directory/'context-manifest.json',m)
 subprocess.run([str(APP/'.venv/Scripts/python.exe'),str(APP/'server/local-video-review.py'),'--video',str(target)],check=True,timeout=240)
def main():
 plan=agent.load(ROOT/'history-production-plan.json')
 if not plan:return
 directory=(ROOT/plan['documentaryDirectory']).resolve();directory.relative_to(ROOT.resolve());m=agent.load(directory/'context-manifest.json')
 day=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=3))).date().isoformat()
 publications=[]
 for p in ROOT.glob('*/publication.json'):
  pub=agent.load(p);manifest=agent.load(p.parent/'manifest.json') or {}
  if manifest.get('kind')=='historical_reel':
   stamp=pub.get('publishedAt')
   pubday=datetime.datetime.fromisoformat(stamp.replace('Z','+00:00')).astimezone(datetime.timezone(datetime.timedelta(hours=3))).date().isoformat() if stamp else manifest.get('date')
   publications.append({**pub,'day':pubday})
 voice=agent.load(directory/'voice-source.json') or {}
 state=daily_state(day,publications,agent.load(directory/'publication.json'),voice.get('voice',{}).get('day'))
 if state:
  state.update(checkedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),directory=str(directory),codexRequired=False)
  if state['status']=='needs_new_daily_story':
   queue=ROOT/'history-story-preparation-requests';queue.mkdir(exist_ok=True);request=queue/(day+'.json')
   if not request.exists():agent.atomic(request,{'day':day,'status':'source_package_required','automaticSourcePreparationImplemented':False,'requirements':['Unique unpublished story linked to today’s venues; Fridays next Gazi year','Dated place/event evidence and verified usage rights','No repeated photos; still shots <=4.5s and <=70 percent overall','Native daily alternating voice and transcript/name checks','Generation or source-grounded documentary fallback','Publication receipt required, never count a preview as delivered'],'previousEpisode':directory.name})
   state['preparationRequest']=str(request);state['automaticSourcePreparationImplemented']=False
  agent.atomic(APP/'data/maintenance/history-production-controller.json',state);return
 preflight=agent.assess(m)
 if preflight['status']!='context_passed':
  agent.atomic(APP/'data/maintenance/history-production-controller.json',{'status':agent.choose_route(None,m),'details':preflight,'published':False});return
 # Explicitly approved, unchanged generated footage may be selected by the context agent.
 route=agent.load(APP/'data/maintenance/history-production-route.json') or {}
 if route.get('route')=='generated_candidate':
  agent.atomic(APP/'data/maintenance/history-production-controller.json',{'status':'generated_candidate_ready_for_publication_gate','published':False});return
 video=directory/m['videoFile']
 if not video.exists() or agent.sha(video)!=m.get('videoSha256'):render(directory,m)
 audit=agent.audit(directory)
 agent.atomic(APP/'data/maintenance/history-production-controller.json',{'status':'documentary_preview_ready' if audit['status']=='context_passed' else 'blocked','directory':str(directory),'context':audit,'published':False,'codexRequired':False,'sourcePreparation':'Requires source-reviewed assets, factual labels and narration in each story package; not autonomous web licensing research'})
if __name__=='__main__':
 lock=open(APP/'data/maintenance/history-production-controller.lock','a+b');lock.seek(0);lock.write(b'0');lock.flush();lock.seek(0)
 try:msvcrt.locking(lock.fileno(),msvcrt.LK_NBLCK,1)
 except OSError:raise SystemExit(0)
 try:main()
 finally:lock.seek(0);msvcrt.locking(lock.fileno(),msvcrt.LK_UNLCK,1);lock.close()
