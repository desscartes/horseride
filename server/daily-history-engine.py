"""Restart-safe local story -> voice -> archive edit -> audits -> publication worker."""
from pathlib import Path
import os,sys,json,hashlib,datetime,subprocess,msvcrt,math,importlib.util,traceback
APP=Path('D:/Apps/HorseRide');ROOT=APP/'data/instagram';MAINT=APP/'data/maintenance';PY=APP/'.venv/Scripts/python.exe';NODE='D:/Tools/node-v24.15.0-win-x64/node.exe'
PREPARE='--prepare-package' in sys.argv
TARGET_DAY=None;PREPARE_PACKAGE=None
if PREPARE:
 import re
 PREPARE_PACKAGE=sys.argv[sys.argv.index('--prepare-package')+1];TARGET_DAY=sys.argv[sys.argv.index('--prepare-day')+1]
 if not re.fullmatch(r'history-bank-[a-z0-9-]+',PREPARE_PACKAGE):raise ValueError('Invalid preparation package')
 target=datetime.date.fromisoformat(TARGET_DAY);today=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=3))).date()
 if not 0<=(target-today).days<=7:raise ValueError('Preflight limited to next seven days; never publishes')
spec=importlib.util.spec_from_file_location('director',APP/'server/history-production-controller.py');director=importlib.util.module_from_spec(spec);spec.loader.exec_module(director);agent=director.agent
review_spec=importlib.util.spec_from_file_location('story_review',APP/'server/history-story-review.py');story_review=importlib.util.module_from_spec(review_spec);review_spec.loader.exec_module(story_review)
def now():
 value=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=3)))
 return datetime.datetime.combine(datetime.date.fromisoformat(TARGET_DAY),value.timetz()) if TARGET_DAY else value
def save(p,v):agent.atomic(p,v)
def state(status,**extra):
 value={'day':now().date().isoformat(),'status':status,'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pid':os.getpid(),'codexRequired':False,'preparationOnly':PREPARE,**extra};save(MAINT/(('daily-history-preflight-'+TARGET_DAY+'.json') if PREPARE else 'daily-history-engine.json'),value);return value
def ts(t):
 n=round(t*100);h,n=divmod(n,360000);m,n=divmod(n,6000);s,c=divmod(n,100);return f'{h}:{m:02}:{s:02}.{c:02}'
def run(args,log,timeout):
 with log.open('a',encoding='utf-8') as out:subprocess.run(list(map(str,args)),cwd=APP,stdout=out,stderr=out,check=True,timeout=timeout,creationflags=subprocess.CREATE_NO_WINDOW|subprocess.BELOW_NORMAL_PRIORITY_CLASS)
def main():
 day=now().date().isoformat();policy=agent.load(ROOT/'daily-history-policy.json') or {}
 if not policy.get('enabled'):return state('disabled')
 replacement=agent.load(ROOT/'history-replacement-request.json') or {}
 if not PREPARE and replacement.get('userRequested') and replacement.get('day')==day and replacement.get('status')!='published_verified':
  run(['C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',APP/'server/confirm-pimlico-removal.ps1'],MAINT/'history-replacement-verification.log',80)
  replacement=agent.load(ROOT/'history-replacement-request.json')
  if replacement.get('status')!='removal_verified':return state('replacement_waiting_for_removal',reason='Old rejected Reel must be remotely removed before the replacement can publish')
  if replacement.get('mediaUploadAuthorization')!='explicitly_approved':return state('replacement_waiting_for_upload_authorization',reason='Automatic approval review requires explicit permission for this video’s public GitHub media transfer')
  save(ROOT/'history-days'/(day+'-autonomous.json'),{'day':day,'packageDirectory':replacement['newPackageDirectory'],'episodeId':replacement['newEpisodeId']})
 published=[];unknown=[]
 for p in ROOT.glob('*/publication.json'):
  receipt=agent.load(p);manifest=agent.load(p.parent/'manifest.json') or {}
  if manifest.get('kind')!='historical_reel':continue
  if receipt.get('status')=='publishing_unknown':
   run(['C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',APP/'server/reconcile-daily-history.ps1','-PublicationId',p.parent.name],MAINT/'daily-history-reconciliation.log',60)
   receipt=agent.load(p)
  if receipt.get('status')=='published_verified':
   published.append({'directory':p.parent.name,'episode':manifest.get('episodeId'),**receipt})
   stamp=receipt.get('publishedAt','')
   if not PREPARE and stamp and datetime.datetime.fromisoformat(stamp.replace('Z','+00:00')).astimezone(now().tzinfo).date().isoformat()==day:return state('published_verified',url=receipt['permalink'])
  if receipt.get('status')=='publishing_unknown':unknown.append(p.parent.name)
 if unknown:return state('publication_reconciliation_required',directories=unknown)
 daily=ROOT/('history-preflight-days' if PREPARE else 'history-days')/(day+'-autonomous.json');daily.parent.mkdir(exist_ok=True)
 selection=agent.load(daily)
 if PREPARE:selection={'day':day,'packageDirectory':PREPARE_PACKAGE};save(daily,selection)
 if not selection or not selection.get('packageDirectory'):
  used={p['episode'] for p in published if p.get('episode')};usedDirs={p['directory'] for p in published};usedAssets=set()
  for prior in published:
   evidence=agent.load(ROOT/prior['directory']/'context-manifest.json') or {}
   usedAssets.update(a.get('sha256') for a in evidence.get('assets',{}).values())
  series=agent.load(ROOT/'gazi-series/ledger.json') or {}
  nextGazi=max([e['year'] for e in series.get('episodes',[]) if e.get('status')=='published_verified'] or [1926])+1
  packages=[];program=agent.load(APP/('data/program-cache/'+day+'.json')) or {};venues=[r.get('city','').casefold() for r in program.get('races',[])]
  if not venues:return state('program_missing',reason='Today’s program is required for story/country relevance')
  for f in ROOT.glob('history-*/story-package.json'):
   pack=agent.load(f)
   if not pack.get('sourceReviewed') or pack['id'] in used or pack['directory'] in usedDirs or pack.get('earliestDay','0000')>day or pack['id'] in (selection or {}).get('rejectedCandidates',{}):continue
   ep=agent.load(f.parent/'episode.json') or {}
   if not any(story_review.assess({**ep,'narration':v},pack)['status']=='story_rules_passed' for v in pack.get('narrationVariants',[ep.get('narration','')])):continue
   if any(a.get('sha256') in usedAssets for a in pack.get('assets',{'archive':pack['asset']}).values()):continue
   if now().weekday()==4 and pack.get('series')!='gazi':continue
   if now().weekday()==4 and pack['asset'].get('year')!=nextGazi:continue
   if now().weekday()!=4 and pack.get('series')=='gazi':continue
   aliases={'US':['abd','usa'],'GB':['ingiltere','england','wolverhampton'],'FR':['fransa','france'],'ZA':['afrika'],'CA':['kanada','canada'],'UY':['uruguay']}
   if pack.get('country')!='TR' and not any(a in v for a in aliases.get(pack.get('country'),[]) for v in venues):continue
   packages.append(pack)
  packages.sort(key=lambda p:(0 if p.get('preferredDay')==day else 1,p.get('id','')))
  if not packages:return state('source_bank_empty',reason='No unused, source-reviewed package for today; never recycle old film or invent evidence')
  if len((selection or {}).get('rejectedCandidates',{}))>=policy.get('maxStoryCandidatesPerDay',3):return state('quality_revision_required',reason='Bounded daily candidate attempts exhausted')
  selection={**(selection or {}),'day':day,'packageDirectory':packages[0]['directory'],'episodeId':packages[0]['id']};save(daily,selection)
 packageDir=(ROOT/selection['packageDirectory']).resolve();packageDir.relative_to(ROOT.resolve());pack=agent.load(packageDir/'story-package.json')
 out=ROOT/('history-daily-'+day+'-'+pack['id']);out.mkdir(exist_ok=True);log=out/'daily-engine.log'
 episode=agent.load(packageDir/'episode.json');variants=pack.get('narrationVariants') or [episode['narration']]
 variants=[v for v in variants if story_review.assess({**episode,'narration':v},pack)['status']=='story_rules_passed']
 if not variants:return state('story_revision_required',directory=str(out),reason='No source-supported specific narrative variant; never delete names or the incident to pass ASR')
 variant_key=hashlib.sha256(json.dumps(variants,ensure_ascii=False).encode()).hexdigest()
 attempt=agent.load(out/'speech-attempt.json') or {};index=attempt.get('index',0) if attempt.get('variantSetSha256')==variant_key else 0
 if index>=len(variants):return state('speech_revision_required',directory=str(out),reason='Curated narration variants exhausted; no unlimited rewriting or loosened checks')
 episode['narration']=variants[index]
 existing=agent.load(out/'episode.json')
 if not existing or existing.get('narration')!=episode['narration']:
  if (out/'publication.json').exists():raise ValueError('Never change a draft after a publication container was created')
  save(out/'episode.json',episode);(out/'narration.txt').write_text(episode['narration'],encoding='utf-8')
 editorial=story_review.audit(out,packageDir)
 if editorial['status']!='story_rules_passed':return state('story_revision_required',directory=str(out),reason='; '.join(editorial['reasons']))
 state('preparing_voice',episode=pack['id'],directory=str(out))
 run([PY,APP/'server/history-motion-native.py',out,'--day',day,'--voice-only'],log,180)
 import wave
 with wave.open(str(out/'narration.wav')) as w:duration=w.getnframes()/w.getframerate()
 asset=pack['asset'];assets=pack.get('assets',{'archive':asset})
 for a in assets.values():
  original=(packageDir/a['file']).resolve();original.relative_to(packageDir.resolve())
  if agent.sha(original)!=a['sha256']:raise ValueError('Curated source checksum changed')
  target=(out/a['file']).resolve();target.relative_to(out.resolve())
  if not target.exists():
   import shutil;shutil.copy2(original,target)
  if agent.sha(target)!=a['sha256']:raise ValueError('Copied source checksum changed')
 cuts=pack['cuts'];capacity=sum(c['availableDuration'] for c in cuts)
 if duration>capacity:raise ValueError('Not enough unique moving footage; never loop or freeze')
 timeline=[];cursor=0
 for c in cuts:
  length=duration*c['availableDuration']/capacity
  key=c.get('asset','archive');a=assets[key];still=Path(a['file']).suffix.lower() in ['.jpg','.png','.jpeg','.webp']
  if not still and not any(c.get('sourceStart',0)>=x and c.get('sourceStart',0)+length<=y for x,y in a.get('verifiedRanges',[])):raise ValueError('Cut outside source-reviewed event range')
  timeline.append({'asset':key,'start':cursor,'end':cursor+length,'sourceStart':c.get('sourceStart',0),'label':c.get('label',f"Gerçek arşiv · {a['place']}, {a['year']}")});cursor+=length
 header='''[Script Info]
ScriptType: v4.00+
PlayResX: 720
PlayResY: 1280
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Title,Segoe UI,35,&H00FFFFFF,&H00FFFFFF,&H00202020,&H90000000,-1,0,0,0,100,100,0,0,1,2,0,8,45,45,160,1
Style: Sub,Segoe UI,33,&H00FFFFFF,&H00FFFFFF,&H00202020,&H90000000,0,0,0,0,100,100,0,0,1,2,0,2,45,45,210,1
Style: Note,Segoe UI,21,&H00FFFFFF,&H00FFFFFF,&H00202020,&H90000000,0,0,0,0,100,100,0,0,1,1,0,2,30,30,150,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
'''
 words=(out/'narration.txt').read_text(encoding='utf-8').split();ass=header
 for i in range(0,len(words),6):ass+=f"Dialogue: 0,{ts(duration*i/len(words))},{ts(duration*min(i+6,len(words))/len(words))},Sub,,0,0,0,,{' '.join(words[i:i+6])}\n"
 ass+=f"Dialogue: 0,0:00:00.00,{ts(duration)},Note,,0,0,0,,Gerçek yarış arşivi · {asset['place']} · {asset['year']}\n"
 labels=pack['screenLabels']
 for i,label in enumerate(labels):
  start=duration*i/len(labels);ass+=f"Dialogue: 0,{ts(start)},{ts(min(start+4,duration))},Title,,0,0,0,,{label}\n"
 (out/'titles.ass').write_text(ass,encoding='utf-8')
 recipe=hashlib.sha256(json.dumps({'pack':pack,'titles':ass},sort_keys=True,ensure_ascii=False).encode()).hexdigest()
 manifest={'route':'documentary','place':asset['place'],'year':asset['year'],'duration':duration,'assets':assets,'timeline':timeline,'videoFile':'reel.mp4','voiceSha256':agent.sha(out/'narration.wav'),'narrationSha256':agent.sha(out/'narration.txt'),'recipeSha256':recipe}
 preflight=agent.assess(manifest)
 if preflight['status']!='context_passed':return state('quality_revision_required',directory=str(out),reason='; '.join(preflight['reasons']))
 prior=agent.load(out/'context-manifest.json');unchanged=prior and prior.get('recipeSha256')==recipe and prior.get('voiceSha256')==manifest['voiceSha256'] and prior.get('narrationSha256')==manifest['narrationSha256'] and (out/'reel.mp4').exists() and agent.sha(out/'reel.mp4')==prior.get('videoSha256')
 if not unchanged:
  state('rendering',episode=pack['id'],directory=str(out));director.render(out,manifest)
 else:
  qa_spec=importlib.util.spec_from_file_location('local_review',APP/'server/local-video-review.py');qa_module=importlib.util.module_from_spec(qa_spec);qa_spec.loader.exec_module(qa_module)
  if not qa_module.cached_review_matches(agent.load(out/'local-video-review.json'),out/'reel.mp4'):run([PY,APP/'server/local-video-review.py','--video',out/'reel.mp4'],log,240)
 context=agent.audit(out);qa=agent.load(out/'local-video-review.json');speech=agent.load(out/'local-speech-review.json')
 def another_candidate(reason):
  if PREPARE:return state('preflight_revision_required',directory=str(out),reason=reason)
  if (out/'publication.json').exists():return state('publication_reconciliation_required',directory=str(out))
  rejected=selection.get('rejectedCandidates',{});rejected[pack['id']]=reason;save(daily,{'day':day,'rejectedCandidates':rejected});state('selecting_alternate_source_package',rejected=rejected);return main()
 if context['status']!='context_passed' or not qa or qa.get('rejectionReasons') or not speech:return another_candidate({'type':'quality','context':context})
 comp=speech['comparison']
 if comp['differences'] or comp['unexpectedRepeatedPhrases'] or comp.get('criticalNameWarnings'):
  if index+1<len(variants):
   save(out/'speech-attempt.json',{'index':index+1,'variantSetSha256':variant_key,'previousComparison':comp});state('retrying_curated_narration',directory=str(out));return main()
  return another_candidate({'type':'speech','comparison':comp})
 state('ready_for_publication',episode=pack['id'],directory=str(out),context=context['status'])
 if PREPARE:return state('preflight_passed',episode=pack['id'],directory=str(out),context=context['status'],speechWordAgreement=comp['wordSequenceAgreement'])
 if now().hour<policy.get('publishFromHour',11) and not '--publish-now' in sys.argv:return state('waiting_for_publication_hour',directory=str(out))
 if not policy.get('autoPublish'):return state('auto_publish_disabled',directory=str(out))
 run([NODE,'--use-system-ca',APP/'server/publish-daily-history.mjs',out.name],log,240)
 receipt=agent.load(out/'publication.json') or {}
 if receipt.get('status')=='published_verified':
  if replacement.get('newPublicationId')==out.name:save(ROOT/'history-replacement-request.json',{**replacement,'status':'published_verified','url':receipt['permalink']})
  return state('published_verified',url=receipt['permalink'],episode=pack['id'],directory=str(out))
 return state('publication_pending',directory=str(out),publicationStatus=receipt.get('status'))
if __name__=='__main__':
 lock=open(MAINT/'daily-history-engine.lock','a+b');lock.seek(0);lock.write(b'0');lock.flush();lock.seek(0)
 try:msvcrt.locking(lock.fileno(),msvcrt.LK_NBLCK,1)
 except OSError:raise SystemExit(0)
 try:main()
 except Exception as e:
  state('failed',error=type(e).__name__+': '+str(e));raise
 finally:lock.seek(0);msvcrt.locking(lock.fileno(),msvcrt.LK_UNLCK,1);lock.close()
