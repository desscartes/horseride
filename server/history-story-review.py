"""Deterministic editorial minimums for curated history scripts; not an interest-scoring oracle."""
from pathlib import Path
import argparse,datetime,hashlib,json,re,urllib.parse
VERSION='specific-reported-story-v1'
BEATS=('hook','conflict','turningPoint','outcome')
KINDS={'contemporary_report','reported_feature','institutional_history'}
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def norm(s):return re.sub(r'\s+',' ',str(s).casefold().replace('ı','i').replace('’',"'")).strip()
def present(fragment,text):return bool(fragment) and norm(fragment) in norm(text)
def assess(episode,package):
 text=episode.get('narration','');contract=package.get('editorialStory') or {};reasons=[]
 if contract.get('version')!=VERSION:reasons.append('Kaynaklı, somut hikâye sözleşmesi yok')
 words=re.findall(r'\S+',text)
 if not 70<=len(words)<=150:reasons.append('Hikâye derinliği: anlatım 70–150 kelime olmalı; yalnız sonuç özeti yeterli değil')
 place=contract.get('venue',{})
 if not any(present(s,text[:330]) for s in [place.get('name'),*place.get('spokenForms',[])]):reasons.append('Hipodrom adı anlatımın girişinde açıkça söylenmiyor')
 if not present(contract.get('dateSpoken'),text):reasons.append('Olayın zamanı anlatımda yok')
 people=contract.get('protagonists',[])
 if len(people)<2:reasons.append('En az iki somut at/kişi/kurum kimliği gerekli')
 for p in people:
  if not any(present(s,text) for s in [p.get('name'),*p.get('spokenForms',[])]):reasons.append('İsim anlatımdan çıkarılmış: '+p.get('name','?'))
 claims={c.get('id'):c for c in contract.get('claims',[])};sources=set(episode.get('sources',[]));excerpts=[]
 for key in BEATS:
  beat=contract.get(key,{})
  if not present(beat.get('excerpt'),text):reasons.append('Anlatımda eksik hikâye adımı: '+key)
  if key=='hook' and not present(beat.get('excerpt'),text[:330]):reasons.append('Somut merak unsuru girişte yok')
  excerpts.append(norm(beat.get('excerpt','')))
  evidence=[claims.get(k,{}) for k in beat.get('claimIds',[])]
  if not evidence or any(not c.get('verified') or not c.get('fact') or not c.get('sourceUrls') or not set(c['sourceUrls']).issubset(sources) for c in evidence):reasons.append('Hikâye adımının doğrulanmış kaynak desteği yok: '+key)
 if len(set(excerpts)-{''})<4:reasons.append('Giriş, engel, dönüm noktası ve sonuç aynı genel cümle olamaz')
 coverage=contract.get('publishedCoverage',[])
 if not any(c.get('kind') in KINDS and c.get('url') in sources and c.get('reviewed') and len(c.get('reportedFact',''))>=35 for c in coverage):reasons.append('Haberde veya güvenilir tarih anlatısında belgelenen ilginç olay yok')
 domains={urllib.parse.urlparse(u).netloc.removeprefix('www.') for c in claims.values() if c.get('verified') for u in c.get('sourceUrls',[]) if u in sources}
 if len(domains)<2:reasons.append('Olay için en az iki farklı kaynak alanı gerekli')
 if not present(contract.get('distinctiveDetail',{}).get('excerpt'),text) or not contract.get('distinctiveDetail',{}).get('claimIds'):reasons.append('Sıradan yarış sonucundan farklı, kaynaklı ayrıntı yok')
 for phrase in ['kazananın adı ekranda','tarih ve isimler ekranda','kazanan atın ve jokeyinin adları ekranda']:
  if present(phrase,text):reasons.append('İsimleri söylemek yerine ekrana havale eden dolgu cümlesi')
 return {'version':VERSION,'status':'story_rules_passed' if not reasons else 'story_revision_required','reasons':list(dict.fromkeys(reasons)),'wordCount':len(words),'checkedCriteria':['named venue in opening','spoken date and named protagonists','source-linked hook/conflict/turn/outcome','reported distinctive fact','no names hidden to satisfy ASR'],'limitations':'Checks curated evidence and textual specificity; cannot guarantee that every viewer finds a story interesting. Does not independently verify arbitrary web claims.'}
def audit(directory,package_dir):
 ep=directory/'episode.json';pack=package_dir/'story-package.json';r=assess(json.loads(ep.read_text(encoding='utf-8-sig')),json.loads(pack.read_text(encoding='utf-8-sig')))
 r.update(episodeSha256=sha(ep),packageSha256=sha(pack),reviewerSha256=sha(Path(__file__)),checkedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),codexRequired=False)
 target=directory/'story-review.json';temp=target.with_suffix('.json.tmp');temp.write_text(json.dumps(r,ensure_ascii=False,indent=2),encoding='utf-8');temp.replace(target);return r
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--directory',type=Path,required=True);p.add_argument('--package',type=Path,required=True);a=p.parse_args();r=audit(a.directory,a.package);print(json.dumps(r,ensure_ascii=False));raise SystemExit(0 if r['status']=='story_rules_passed' else 2)
