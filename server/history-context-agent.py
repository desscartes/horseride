"""Local evidence/timeline gate and production-route selector; no network or automatic aesthetic approval."""
from pathlib import Path
import argparse,json,hashlib,datetime
APP=Path('D:/Apps/HorseRide');VERSION='history-context-agent-v2'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def load(p):return json.loads(p.read_text(encoding='utf-8-sig')) if p.exists() else None
def atomic(p,data):
 tmp=p.with_suffix(p.suffix+'.tmp');tmp.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8');tmp.replace(p)
def assess(m):
 errors=[];context=event=0.;cursor=0.;still_seconds=0.;seen_stills={};repeated=[];long_stills=[];video_ranges={}
 if not m:return {'status':'rejected','reasons':['Story-to-image evidence manifest missing'],'contextFraction':0}
 assets=m.get('assets',{});duration=m.get('duration',0)
 for shot in m.get('timeline',[]):
  a=assets.get(shot.get('asset'),{});start,end=shot.get('start',-1),shot.get('end',-1)
  if start<0 or end<=start or abs(start-cursor)>.08:errors.append('Invalid or discontinuous timeline')
  cursor=end;length=max(0,end-start)
  is_still=Path(a.get('file','')).suffix.lower() in ['.jpg','.jpeg','.png','.webp']
  if is_still:
   still_seconds+=length
   identity=a.get('sha256') or shot.get('asset')
   if identity in seen_stills:repeated.append({'firstStart':seen_stills[identity],'repeatStart':start,'asset':shot.get('asset')})
   else:seen_stills[identity]=start
   if length>4.5:long_stills.append({'start':start,'end':end,'asset':shot.get('asset')})
  elif a.get('sha256'):
   source_start=shot.get('sourceStart',0);source_end=source_start+length
   ranges=video_ranges.setdefault(a['sha256'],[])
   if any(source_start<b-.04 and source_end>a0+.04 for a0,b in ranges):errors.append('Repeated/overlapping moving footage')
   ranges.append((source_start,source_end))
   if a.get('verifiedRanges') and not any(source_start>=a0 and source_end<=b for a0,b in a['verifiedRanges']):errors.append('Moving cut outside source-reviewed event range')
  if not all(a.get(k) for k in ['source','rights','sha256','description','sourceChecked']):errors.append('Unchecked source or missing rights/provenance')
  relation=a.get('relation')
  if relation in ['period_context','primary_text','direct_event']:
   if a.get('place')!=m.get('place') or not isinstance(a.get('year'),int) or abs(a['year']-m.get('year',0))>3:errors.append('Place/period mismatch')
   else:context+=length
  if relation in ['primary_text','direct_event']:event+=length
  if relation=='illustration' and not any(s in shot.get('label','').lower() for s in ['temsili','illustrat']):errors.append('Illustration not disclosed')
  label=shot.get('label','').lower()
  if relation=='period_context' and not any(x in label for x in ['bağlam','yarış görüntüsü değildir','arşiv ayrıntısı']):errors.append('Context photo must not masquerade as the event')
 if duration<=0 or abs(cursor-duration)>.12:errors.append('Timeline duration mismatch')
 fraction=context/max(duration,.001)
 if fraction<.65:errors.append('Mostly generic illustrations; period/story evidence must cover at least 65%')
 if event<4:errors.append('No substantial event-specific primary text or factual record')
 if repeated:errors.append('Repeated still image: changing crop or zoom does not make it a new scene')
 if long_stills:errors.append('Still/document shot longer than 4.5 seconds')
 still_fraction=still_seconds/max(duration,.001)
 if still_fraction>.7:errors.append('Slideshow-dominated edit: stills exceed 70 percent; camera pan does not count as live action')
 return {'status':'context_passed' if not errors else 'rejected','reasons':list(dict.fromkeys(errors)),'contextFraction':fraction,'eventEvidenceSeconds':event,'stillFraction':still_fraction,'repeatedStills':repeated,'longStillShots':long_stills,'aestheticApproval':False,'basis':'Source-reviewed metadata and checksum-bound edit timeline, not autonomous historical fact discovery'}
def choose_route(generated,documentary):
 # A successful render or positive uncalibrated VLM opinion is insufficient.
 if generated and generated.get('status')=='approved' and all(generated.get(k) is True for k in ['visualReviewed','voiceReviewed','storyReviewed','hashBoundVerified']):return 'generated_candidate'
 if assess(documentary)['status']=='context_passed':return 'documentary'
 if documentary and any('still' in r.lower() or 'slideshow' in r.lower() for r in assess(documentary)['reasons']):return 'needs_edit_revision'
 return 'needs_story_sources'
def audit(directory):
 m=load(directory/'context-manifest.json');result=assess(m)
 if m:
  try:
   video=(directory/m['videoFile']).resolve();video.relative_to(directory.resolve())
   if sha(video)!=m.get('videoSha256'):result['reasons'].append('Changed video invalidates context review')
   for a in m['assets'].values():
    p=(directory/a['file']).resolve();p.relative_to(directory.resolve())
    if sha(p)!=a['sha256']:result['reasons'].append('Changed source asset')
   for shot in m['timeline']:
    p=(directory/shot['renderedClip']).resolve();p.relative_to(directory.resolve())
    if sha(p)!=shot['clipSha256']:result['reasons'].append('Changed rendered shot')
   for file,key in [('narration.wav','voiceSha256'),('narration.txt','narrationSha256')]:
    if sha(directory/file)!=m[key]:result['reasons'].append('Changed narration invalidates context review')
  except (OSError,ValueError,KeyError):result['reasons'].append('Missing or unsafe evidence path')
  if result['reasons']:result['status']='rejected'
  result['videoSha256']=m.get('videoSha256');result['manifestSha256']=sha(directory/'context-manifest.json')
 result.update(version=VERSION,checkedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),codexRequired=False,networkCalls=0,autoPublish=False)
 atomic(directory/'context-review.json',result);return result
def main():
 p=argparse.ArgumentParser();p.add_argument('--directory',type=Path);p.add_argument('--scan',action='store_true');a=p.parse_args()
 if a.directory:print(json.dumps(audit(a.directory),ensure_ascii=False));return
 if a.scan:
  root=APP/'data/instagram';reports=[]
  for f in root.glob('history-*/context-manifest.json'):
   old=load(f.parent/'context-review.json');m=load(f)
   if old and old.get('version')==VERSION and old.get('manifestSha256')==sha(f) and old.get('videoSha256')==sha(f.parent/m['videoFile']):continue
   reports.append(audit(f.parent))
  plan=load(root/'history-production-plan.json')
  if plan:
   fallback=(root/plan['documentaryDirectory']).resolve();fallback.relative_to(root.resolve())
   context=audit(fallback);gen=(root/plan['generatedDirectory']).resolve();gen.relative_to(root.resolve());generated=load(gen/'final-quality-approval.json')
   if generated:
    generated['hashBoundVerified']=all((gen/f).exists() and sha(gen/f)==generated.get(k) for f,k in [('reel.mp4','videoSha256'),('narration.wav','voiceSha256'),('narration.txt','narrationSha256')])
   route=choose_route(generated,load(fallback/'context-manifest.json'))
   if context['status']!='context_passed' and route=='documentary':route='needs_story_sources'
   atomic(APP/'data/maintenance/history-production-route.json',{'route':route,'reason':'Generation without explicit semantic approval falls back to source-grounded documentary','context':context,'autoPublish':False,'codexRequired':False})
  if reports:atomic(APP/'data/maintenance/history-context-agent-latest.json',reports[-1])
if __name__=='__main__':main()
