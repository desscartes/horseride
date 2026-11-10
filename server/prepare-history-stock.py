"""Local rolling seven-day preflight. It cannot publish or invent source packages."""
from pathlib import Path
import json,datetime,subprocess,os,msvcrt,hashlib,importlib.util
APP=Path('D:/Apps/HorseRide');ROOT=APP/'data/instagram';MAINT=APP/'data/maintenance';PY=APP/'.venv/Scripts/python.exe'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig')) if p.exists() else {}
def write(p,v):
 temp=p.with_suffix('.tmp');temp.write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8');temp.replace(p)
def main():
 spec=importlib.util.spec_from_file_location('story_review',APP/'server/history-story-review.py');reviewer=importlib.util.module_from_spec(spec);spec.loader.exec_module(reviewer)
 today=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=3))).date();rows=[];pending=[]
 packs=[read(f) for f in ROOT.glob('history-*/story-package.json')]
 used=set()
 for f in ROOT.glob('*/publication.json'):
  if read(f).get('status')=='published_verified':used.add(read(f.parent/'manifest.json').get('episodeId'))
 series=read(ROOT/'gazi-series/ledger.json');year=max([e['year'] for e in series.get('episodes',[]) if e.get('status')=='published_verified'] or [1926])+1
 for offset in range(1,8):
  date=today+datetime.timedelta(days=offset);day=date.isoformat()
  matches=[p for p in packs if p.get('id') not in used and p.get('sourceReviewed') and (p.get('asset',{}).get('year')==year and p.get('series')=='gazi' if date.weekday()==4 else p.get('preferredDay')==day and p.get('series')!='gazi')]
  if not matches:rows.append({'day':day,'status':'source_package_missing','series':'gazi' if date.weekday()==4 else 'world','requiredYear':year if date.weekday()==4 else None});continue
  p=matches[0];fingerprint=hashlib.sha256(json.dumps(p,sort_keys=True,ensure_ascii=False).encode()+b''.join((APP/'server'/n).read_bytes() for n in ['history-story-review.py','local-speech-review.py','local-video-review.py'])).hexdigest();receipt=read(MAINT/('daily-history-preflight-'+day+'.json'))
  episode=read(ROOT/p['directory']/'episode.json')
  editorial=[reviewer.assess({**episode,'narration':v},p) for v in p.get('narrationVariants',[episode.get('narration','')])]
  if not any(r['status']=='story_rules_passed' for r in editorial):
   rows.append({'day':day,'package':p['directory'],'status':'story_revision_required','reason':editorial[0]['reasons']});continue
  stamp=read(MAINT/('history-stock-attempt-'+day+'.json'));same=stamp.get('packageSha256')==fingerprint
  status=receipt.get('status') if same else 'preparation_pending'
  if not same or not stamp.get('completed'):pending.append((day,p,fingerprint))
  rows.append({'day':day,'package':p['directory'],'status':status,'programRelevanceRecheckedOnPublicationDay':True})
 report={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'days':rows,'codexRequired':False,'canPublish':False,'sourcesAreCurated':True,'missingSourceDays':[r['day'] for r in rows if r['status']=='source_package_missing']}
 write(MAINT/'history-rolling-stock.json',report)
 if not pending:return
 day,p,fingerprint=pending[0];marker=MAINT/('history-stock-attempt-'+day+'.json');write(marker,{'packageSha256':fingerprint,'completed':False})
 with (MAINT/'history-rolling-stock.log').open('a',encoding='utf-8') as log:
  result=subprocess.run([str(PY),'-u',str(APP/'server/daily-history-engine.py'),'--prepare-day',day,'--prepare-package',p['directory']],cwd=APP,stdout=log,stderr=log,timeout=600,creationflags=subprocess.CREATE_NO_WINDOW|subprocess.BELOW_NORMAL_PRIORITY_CLASS)
 receipt=read(MAINT/('daily-history-preflight-'+day+'.json'))
 terminal=receipt.get('status') in ['preflight_passed','preflight_revision_required','quality_revision_required','story_revision_required']
 write(marker,{'packageSha256':fingerprint,'completed':terminal,'exitCode':result.returncode,'status':receipt.get('status'),'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()})
 for r in rows:
  if r['day']==day:r['status']=receipt.get('status','failed')
 write(MAINT/'history-rolling-stock.json',report)
if __name__=='__main__':
 lock=open(MAINT/'history-rolling-stock.lock','a+b');lock.write(b'0');lock.flush();lock.seek(0)
 try:msvcrt.locking(lock.fileno(),msvcrt.LK_NBLCK,1)
 except OSError:raise SystemExit(0)
 try:main()
 finally:lock.seek(0);msvcrt.locking(lock.fileno(),msvcrt.LK_UNLCK,1);lock.close()
