"""Offline ASR evidence, not a judge of accent or acting quality."""
from pathlib import Path
import sys,os,json,hashlib,re,difflib,collections,subprocess
APP=Path('D:/Apps/HorseRide');sys.path.insert(0,str(APP/'review-tools'))
os.environ['HF_HUB_OFFLINE']='1';os.environ['HF_HUB_DISABLE_IMPLICIT_TOKEN']='1'
def norm(s):
 s=s.lower().replace('\u0307','').replace('ı','i').replace('’',"'").replace('â','a').replace('î','i').replace('û','u')
 s=s.replace('primerole','primerol');tokens=re.findall(r'\w+',s.replace("'",''),re.UNICODE)
 numbers={'sifir':0,'bir':1,'iki':2,'üç':3,'dört':4,'beş':5,'alti':6,'yedi':7,'sekiz':8,'dokuz':9,'on':10,'yirmi':20,'otuz':30,'kirk':40,'elli':50,'altmiş':60,'yetmiş':70,'seksen':80,'doksan':90}
 out=[];i=0
 while i<len(tokens):
  if tokens[i] not in numbers and tokens[i] not in ['yüz','bin']:out.append(tokens[i]);i+=1;continue
  total=current=0
  while i<len(tokens) and (tokens[i] in numbers or tokens[i] in ['yüz','bin']):
   t=tokens[i]
   if t=='yüz':current=max(1,current)*100
   elif t=='bin':total+=max(1,current)*1000;current=0
   else:current+=numbers[t]
   i+=1
  out.append(str(total+current))
 return out
def compare(expected,heard):
 a,b=norm(expected),norm(heard);match=difflib.SequenceMatcher(None,a,b,autojunk=False)
 changes=[{'expected':' '.join(a[i:j]),'heard':' '.join(b[k:l])} for op,i,j,k,l in match.get_opcodes() if op!='equal']
 def grams(tokens):return collections.Counter(tuple(tokens[i:i+5]) for i in range(max(0,len(tokens)-4)))
 ga,gb=grams(a),grams(b)
 repeats=[' '.join(g) for g,c in gb.items() if c>max(1,ga[g])]
 return {'wordSequenceAgreement':match.ratio(),'differences':changes,'unexpectedRepeatedPhrases':repeats,
  'status':'review_required' if match.ratio()<.8 or repeats else 'transcript_consistent_not_pronunciation_approval'}

def spoken_text(text,aliases):
 if not aliases:return text
 lookup={k.casefold():v for k,v in aliases.items()}
 pattern=re.compile(r'(?<!\w)(?:'+'|'.join(re.escape(k) for k in sorted(aliases,key=len,reverse=True))+r')(?!\w)',re.IGNORECASE)
 return pattern.sub(lambda m:lookup[m.group().casefold()],text)

def name_present(alias,heard):
 target=norm(alias);tokens=norm(heard)
 suffixes={'','a','e','i','u','ü','da','de','ta','te','dan','den','tan','ten','in','un','ün','nin','nun','nün','daki','deki'}
 for i in range(len(tokens)-len(target)+1):
  span=tokens[i:i+len(target)]
  if target and span[:-1]==target[:-1] and span[-1].startswith(target[-1]) and span[-1][len(target[-1]):] in suffixes:return True
 return False
def main():
 from faster_whisper import WhisperModel
 source=Path(sys.argv[1]).resolve();directory=source.parent
 model=WhisperModel(str(APP/'review-models/faster-whisper-small'),device='cpu',compute_type='int8',cpu_threads=2,num_workers=1,local_files_only=True)
 import numpy as np,imageio_ffmpeg
 # Decode with the project's pinned FFmpeg, avoiding PyAV API-version differences.
 pcm=subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-v','error','-i',str(source),'-t','120','-vn','-ac','1','-ar','16000','-f','f32le','-'],capture_output=True,check=True,timeout=50).stdout
 samples=np.frombuffer(pcm,dtype='<f4').copy()
 segments,info=model.transcribe(samples,language='tr',beam_size=3,temperature=0,condition_on_previous_text=False,vad_filter=False)
 rows=[{'start':s.start,'end':s.end,'text':s.text,'averageLogProbability':s.avg_logprob} for s in segments]
 heard=' '.join(s['text'] for s in rows);expected=(directory/'narration.txt').read_text(encoding='utf-8-sig')
 epfile=directory/'episode.json';ep=json.loads(epfile.read_text(encoding='utf-8-sig')) if epfile.exists() else {}
 aliasfile=APP/'data/instagram/native-renderer/pronunciations.json'
 aliases=json.loads(aliasfile.read_text(encoding='utf-8-sig')) if aliasfile.exists() else {};aliases.update(ep.get('pronunciations',{}))
 comparison=compare(spoken_text(expected,aliases),spoken_text(heard,aliases))
 warnings=[];heard_tokens=' '+' '.join(norm(spoken_text(heard,aliases)))+' '
 for name,alias in ep.get('pronunciations',{}).items():
  if name in expected and not name_present(alias,spoken_text(heard,aliases)):
   prefix=' '.join(norm(alias))[:3]
   spans=[{'start':s['start'],'end':s['end'],'heard':s['text']} for s in rows if prefix in ' '.join(norm(s['text']))]
   warnings.append({'name':name,'expectedSpokenForm':alias,'segmentsToListen':spans,'action':'Listen to the name; ASR mismatch alone cannot prove mispronunciation'})
 comparison['wordDifferencesToListen']=[]
 for diff in comparison['differences']:
  fragment=' '.join(norm(diff['heard']))
  if fragment:
   spans=[{'start':s['start'],'end':s['end']} for s in rows if fragment in ' '.join(norm(s['text']))]
   comparison['wordDifferencesToListen'].append({**diff,'segments':spans})
 comparison['criticalNameWarnings']=warnings
 if warnings:comparison['status']='review_required'
 report={'version':'local-speech-review-v1','inputSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'input':str(source),'engine':'faster-whisper 1.2.1 / small / CPU int8','transcript':heard,'segments':rows,'comparison':comparison,'autoApproval':False,'networkCalls':0,'limitation':'Agreement cannot establish native pronunciation, emphasis, natural acting or correct foreign-name phonetics.'}
 target=directory/'local-speech-review.json';temp=target.with_suffix('.json.tmp');temp.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');temp.replace(target)
 print(json.dumps({'status':report['comparison']['status'],'agreement':report['comparison']['wordSequenceAgreement'],'autoApproval':False}))
if __name__=='__main__':main()
