from pathlib import Path
import json,subprocess,os,time
base=Path('D:/Apps/HorseRide');root=base/'data/maintenance/unattended-history-preview';root.mkdir(parents=True,exist_ok=True)
ep=json.loads((base/'data/instagram/history-catalog.json').read_text(encoding='utf-8'))['episodes']
ep=next(e for e in ep if e['id']=='epsom-1780')
(root/'episode.json').write_text(json.dumps(ep,ensure_ascii=False),encoding='utf-8')
(root/'narration.txt').write_text(ep['narration'],encoding='utf-8')
env={**os.environ,'PYTHONUTF8':'1','HF_HUB_OFFLINE':'1','TRANSFORMERS_OFFLINE':'1'}
start=time.time()
subprocess.run([str(base/'.voice-venv/Scripts/python.exe'),str(base/'server/history-voice.py'),str(root)],env=env,check=True,timeout=180)
subprocess.run([str(base/'.venv/Scripts/python.exe'),str(base/'server/history-render.py'),str(root)],env=env,check=True,timeout=240)
result={'status':'verified','localVoice':True,'localVideo':True,'offlineModel':True,'elapsedSeconds':round(time.time()-start,1),'bytes':(root/'reel.mp4').stat().st_size}
(base/'data/maintenance/unattended-history-selfcheck.json').write_text(json.dumps(result),encoding='utf-8')
print(json.dumps(result))
