"""Offline, bounded video audit. Technical evidence is never editorial approval."""
import argparse, datetime as dt, hashlib, json, pathlib, re, subprocess, wave
import numpy as np
import imageio_ffmpeg

VERSION = 'local-video-review-v2'
APP = pathlib.Path('D:/Apps/HorseRide')
REJECTED = {
 '8a3b2e8d029e8f36c8517d22f67981042595504b64549d838aeaf50a49c65b5f': 'User rejected silhouette/information graphics instead of cinematic video',
 '45b9ad42be046c1f06c20677424c35f2938ba034e77667e6204c0e396c6f50f0': 'User rejected Funny Cide story, visuals and narration; removed at user request',
}
BASELINE = 'e1762d775ac829364c746086086dbbdada5518d38853f73035171b9195881730'

def sha(p):
 h = hashlib.sha256()
 with open(p, 'rb') as f:
  for b in iter(lambda: f.read(1048576), b''): h.update(b)
 return h.hexdigest()

def load(p):
 return json.loads(p.read_text(encoding='utf-8-sig')) if p.exists() else None

def save(p, obj):
 tmp = p.with_suffix(p.suffix + '.tmp')
 tmp.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding='utf-8')
 tmp.replace(p)

def cached_review_matches(previous, video):
 if not previous or previous.get('version')!=VERSION or previous.get('status') in ['audit_incomplete','audit_failed']:return False
 if previous.get('checkerSha256')!=checker_sha():return False
 expected={'videoSha256':video,'voiceSha256':video.parent/'narration.wav','narrationSha256':video.parent/'narration.txt'}
 return all(previous.get('hashes',{}).get(key)==(sha(path) if path.exists() else None) for key,path in expected.items())

def checker_sha():
 paths=[pathlib.Path(__file__),APP/'server/local-speech-review.py']
 return hashlib.sha256(b''.join(p.read_bytes() for p in paths if p.exists())).hexdigest()

def frame_metrics(frames):
 if len(frames) < 2: return {'samples':len(frames), 'staticFraction':1.0, 'blackFraction':1.0}
 a = np.asarray(frames, dtype=np.float32)
 changes = np.mean(np.abs(np.diff(a, axis=0)), axis=(1,2))
 return {'samples':len(frames), 'staticFraction':float(np.mean(changes < 1.2)),
         'blackFraction':float(np.mean(np.mean(a, axis=(1,2)) < 2)),
         'meanFrameChange':float(np.mean(changes))}

def audio_metrics(samples, rate):
 a = np.asarray(samples, dtype=np.float32) / 32768
 n = max(1, int(rate*.02)); a = a[:len(a)//n*n].reshape(-1,n)
 if not len(a): return {'silentFraction':1., 'longestSilenceSeconds':0., 'clippedFraction':0.}
 silent = np.sqrt(np.mean(a*a,axis=1)) < .0032
 longest = current = 0
 for s in silent:
  current = current + 1 if s else 0; longest = max(longest,current)
 return {'silentFraction':float(np.mean(silent)), 'longestSilenceSeconds':longest*.02,
         'clippedFraction':float(np.mean(np.abs(a) > .999))}

def review(video):
 directory = video.parent
 ff = imageio_ffmpeg.get_ffmpeg_exe()
 # Full stream decode catches corruption outside sampled frames. Timeouts bound every invocation.
 subprocess.run([ff,'-v','error','-i',str(video),'-f','null','-'], check=True, capture_output=True, timeout=55)
 raw = subprocess.run([ff,'-v','error','-i',str(video),'-t','90','-vf','fps=2,scale=160:284,format=gray','-an','-f','rawvideo','-'], check=True,capture_output=True,timeout=25).stdout
 frames = np.frombuffer(raw,dtype=np.uint8).reshape(-1,284,160)
 pcm = subprocess.run([ff,'-v','error','-i',str(video),'-t','90','-vn','-ac','1','-ar','16000','-f','s16le','-'],check=True,capture_output=True,timeout=25).stdout
 sound = np.frombuffer(pcm,dtype='<i2')
 vm, am = frame_metrics(frames), audio_metrics(sound,16000)
 hashes = {'videoSha256':sha(video)}
 for name,key in [('narration.wav','voiceSha256'),('narration.txt','narrationSha256')]:
  if (directory/name).exists(): hashes[key] = sha(directory/name)
 reasons=[]; concerns=[]; speech={'status':'unavailable'}
 speech_model=APP/'review-models/faster-whisper-small/verified-local-model.json'
 if speech_model.exists() and (directory/'narration.txt').exists():
  try:
   subprocess.run([str(APP/'.venv/Scripts/python.exe'),str(APP/'server/local-speech-review.py'),str(video)],check=True,capture_output=True,timeout=180,creationflags=subprocess.CREATE_NO_WINDOW)
   speech=load(directory/'local-speech-review.json')
   if speech.get('inputSha256')!=hashes['videoSha256']:raise ValueError('Speech audit input changed')
   if speech['comparison']['status']=='review_required':concerns.append('Spoken words differ from script: inspect local-speech-review.json')
  except Exception as e:speech={'status':'failed','error':type(e).__name__}
 if hashes['videoSha256'] in REJECTED: reasons.append(REJECTED[hashes['videoSha256']])
 if vm['blackFraction'] > .1: reasons.append('Excessive black sampled frames')
 if vm['staticFraction'] > .65: reasons.append('Mostly static sampled frames')
 if am['silentFraction'] > .5: reasons.append('Narration missing or mostly silent')
 if am['longestSilenceSeconds'] > .8: concerns.append('Long pause: listen before approval')
 if am['clippedFraction'] > .001: reasons.append('Audio clipping')
 voice = load(directory/'voice-source.json') or {}
 voice = voice.get('voice',{})
 if isinstance(voice,dict) and voice.get('day'):
  day=dt.date.fromisoformat(voice['day']); expected='tr-TR-AhmetNeural' if (day-dt.date(2026,11,3)).days%2==0 else 'tr-TR-EmelNeural'
  if voice.get('voice') != expected: reasons.append('Voice does not match alternating daily calendar')
 else: concerns.append('Voice calendar evidence missing')
 # Metadata, pixel change and an uncalibrated VLM cannot prove pronunciation, anatomy or storytelling.
 concerns += ['Historical claims and visual licences require source review',
              'Motion score does not establish coherent action, face/horse identity or correct gait',
              'Transcript agreement does not prove native pronunciation or narrative flow; listening still required']
 return {'version':VERSION,'checkerSha256':checker_sha(),'checkedAt':dt.datetime.now(dt.timezone.utc).isoformat(),
  'status':'rejected' if reasons else ('audit_incomplete' if speech.get('status') in ['unavailable','failed'] else 'needs_editorial_review'), 'autoApproval':False,
  'video':str(video),'hashes':hashes,'baselineSha256':BASELINE,
  'durationSampledSeconds':len(sound)/16000,'frames':vm,'audio':am,'speech':speech,
  'rejectionReasons':reasons,'reviewConcerns':concerns,
  'editorialChecklist':{
   'cinematicContinuousActionNotSlides':'unverified',
   'horseAnatomyGaitAndIdentityConsistent':'unverified',
   'interestingTrueStoryAndImagesMatchNarration':'unverified',
   'naturalTurkishForeignNamesPronouncedCorrectly':'unverified',
   'shortReadableCaptionsNotTextHeavyImages':'unverified',
   'newStoryAndDistinctFootageNotRecycled':'unverified',
   'sourceLicencesAndMusicCommercialUse':'unverified',
   'reference':'fio-rito-visual-v7-native-v6'},
  'codexRequired':False,'networkCalls':0}

def main():
 p=argparse.ArgumentParser();p.add_argument('--video');p.add_argument('--scan',action='store_true');a=p.parse_args()
 if a.video:
  video=pathlib.Path(a.video).resolve();result=review(video);save(video.parent/'local-video-review.json',result);print(json.dumps(result,ensure_ascii=False));return
 if a.scan:
  import msvcrt
  root=APP/'data/maintenance'; lock=open(root/'local-video-review.lock','a+b');lock.seek(0);lock.write(b'0');lock.flush();lock.seek(0)
  try: msvcrt.locking(lock.fileno(),msvcrt.LK_NBLCK,1)
  except OSError: print('{"status":"already_running"}');return
  try:
   candidates=[]
   for directory in (APP/'data/instagram').glob('history-*'):
    if not directory.is_dir(): continue
    video=directory/'reel.mp4'
    if not video.exists(): continue
    previous=load(directory/'local-video-review.json')
    if cached_review_matches(previous,video): continue
    candidates.append(video)
   if candidates:
    video=max(candidates,key=lambda x:x.stat().st_mtime)
    try: result=review(video)
    except Exception as e: result={'version':VERSION,'status':'audit_failed','autoApproval':False,'error':type(e).__name__,'video':str(video)}
    save(video.parent/'local-video-review.json',result);save(root/'local-video-review-latest.json',result)
   else: print('{"status":"up_to_date"}')
  finally: lock.seek(0);msvcrt.locking(lock.fileno(),msvcrt.LK_UNLCK,1);lock.close()

if __name__=='__main__': main()
