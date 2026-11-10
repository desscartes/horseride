from pathlib import Path
import sys,json,re,wave
import numpy as np
from ema_lightning import EMA
root=Path(sys.argv[1]); ep=json.loads((root/'episode.json').read_text(encoding='utf-8-sig'))
text=(root/'narration.txt').read_text(encoding='utf-8').strip()
segments=ep.get('narrationSegments')
if segments:
    if ' '.join(s['text'].strip() for s in segments)!=text:raise ValueError('Narration plan differs from approved factual text')
else:
    sentences=re.split(r'(?<=[.!?])\s+',text)
    segments=[{'text':s,'speed':.90 if i==0 else (.89 if i==len(sentences)-1 else .97),'pauseAfter':.65 if i==0 else (.55 if i==len(sentences)-1 else .28)} for i,s in enumerate(sentences) if s.strip()]
voice=EMA();audio=[];words=[];offset=0.;rate=None;plan=[]
lexicon=json.loads((Path(__file__).parent/'history-pronunciations.json').read_text(encoding='utf-8-sig'))
lexicon.update(ep.get('pronunciations',{}))
reverse={}
for original,spoken in lexicon.items():
    if len(original.split())==len(spoken.split()):reverse.update(zip(spoken.split(),original.split()))
def pronounce(value):
    for original,spoken in sorted(lexicon.items(),key=lambda kv:-len(kv[0])):
        value=re.sub(r'(?<![A-Za-z])'+re.escape(original)+r'(?![A-Za-z])',lambda m:spoken,value,flags=re.IGNORECASE|re.ASCII)
    return value
def display(value):
    for spoken,original in reverse.items():value=re.sub(re.escape(spoken),lambda m:original,value,flags=re.IGNORECASE)
    return value
for segment in segments:
    spoken=pronounce(segment['text'])
    speech=voice.say(spoken,seed=ep['year'],speed=segment.get('speed',.96))
    rate=speech.sample_rate;part=speech.audio.astype(np.float32).copy()
    gain=segment.get('gain',1.1 if segment.get('speed',1)<.9 else 1.0);part*=gain
    # Short fades avoid clicks between narrated beats without changing the voice's pitch.
    fade=min(int(rate*.008),len(part)//2)
    if fade:part[:fade]*=np.linspace(0,1,fade);part[-fade:]*=np.linspace(1,0,fade)
    audio.append(part)
    words.extend({'text':display(w.text),'start':round(w.start+offset,4),'end':round(w.end+offset,4)} for w in speech.words)
    pause=max(0,min(1.2,float(segment.get('pauseAfter',.35))))
    plan.append({'text':segment['text'],'spokenText':spoken,'start':offset,'speed':segment.get('speed',.96),'gain':gain,'pauseAfter':pause})
    silence=np.zeros(round(pause*rate),np.float32);audio.append(silence);offset+=(len(part)+len(silence))/rate
samples=np.concatenate(audio);peak=float(np.max(np.abs(samples)))
if peak: samples*=min(.85/peak,1.5)
with wave.open(str(root/'narration.wav'),'wb') as out:
    out.setnchannels(1);out.setsampwidth(2);out.setframerate(rate);out.writeframes((np.clip(samples,-1,1)*32767).astype('<i2').tobytes())
(root/'narration-timing.json').write_text(json.dumps({'duration':len(samples)/rate,'sampleRate':rate,'words':words,'voiceStyle':'venue-story-v3','beats':plan},ensure_ascii=False),encoding='utf-8')
print(json.dumps({'duration':len(samples)/rate,'voiceStyle':'venue-story-v3','beats':len(plan)},ensure_ascii=False))
