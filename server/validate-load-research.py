"""Observed-load feature diagnostic; fixed parent parameters, earlier validation only. Never activates a model."""
import json,sys,hashlib
from pathlib import Path
import numpy as np
from catboost import CatBoostRanker,Pool
root=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
parent=read(root/'US/report.json');data=read(root/'US/US-training.json');extra=read(out/'load-features-v1.json')
if hashlib.sha256((out/'source-manifest.json').read_bytes()).hexdigest()!=extra['sourceSha256']:raise ValueError('Frozen source hash mismatch')
training_hash=hashlib.sha256((root/'US/US-training.json').read_bytes()).hexdigest()
if training_hash!=extra['trainingSha256'] or training_hash[:12]!=parent['trainingFingerprint']:raise ValueError('Frozen training fingerprint mismatch')
if len(extra['races'])!=len(data['races']):raise ValueError('Race alignment mismatch')
rows=[]
for old,new in zip(data['races'],extra['races']):
 if [old[k] for k in ['date','city','no']]!=[new[k] for k in ['date','city','no']] or old['horses']!=new['horses'] or len(old['features'])!=len(new['features']):raise ValueError('Runner alignment mismatch')
 if any(len(f)!=len(extra['featureNames']) or not all(isinstance(v,(int,float)) and np.isfinite(v) for v in f) for f in new['features']):raise ValueError('Invalid load feature vectors')
 # Later test dates are never used for fitting, scoring or parameter selection.
 if old['date']>parent['validation']['through']:continue
 rows.append({**old,'features':[a+b for a,b in zip(old['features'],new['features'])]})
train=[r for r in rows if parent['train']['from']<=r['date']<parent['validation']['from']]
validation=[r for r in rows if parent['validation']['from']<=r['date']<=parent['validation']['through']]
if len(train)<300 or len(validation)<20:raise ValueError('Insufficient earlier validation')
original_count=len(data['featureNames']);added=[i for i in range(original_count,original_count+len(extra['featureNames'])) if len({f[i] for r in train for f in r['features']})>1]
parameters=parent['trainingParameters'];temperature=parent['temperature']
def pool(races,indexes):
 x=[];y=[];groups=[]
 for g,r in enumerate(races):x.extend([[f[i] for i in indexes] for f in r['features']]);y.extend(r['labels']);groups.extend([g]*len(r['labels']))
 return Pool(np.asarray(x,float),np.asarray(y,float),group_id=groups)
if '--preflight-only' in sys.argv:
 print(json.dumps({'phase':'preflight_complete','trainingFingerprint':training_hash,'trainRaces':len(train),'validationRaces':len(validation),'testScored':False,'addedIndexes':added,'parameters':parameters}),flush=True)
 sys.exit(0)
results=[]
for name,indexes in [('control',parent['featureIndexes']),('load',parent['featureIndexes']+added)]:
 model=CatBoostRanker(**parameters,loss_function='YetiRank',random_seed=42,thread_count=2,verbose=False,allow_writing_files=False)
 print(json.dumps({'phase':'fitting','variant':name,'trainRaces':len(train),'validationRaces':len(validation)}),flush=True)
 model.fit(pool(train,indexes));scores=model.predict(pool(validation,indexes));offset=0;metrics=[]
 for r in validation:
  n=len(r['labels']);s=np.asarray(scores[offset:offset+n],float);offset+=n;y=np.asarray(r['labels'],float);y/=y.sum();z=s/temperature;p=np.exp(z-z.max());p/=p.sum();order=np.argsort(-p,kind='stable')
  metrics.append({'date':r['date'],'logLoss':float(-np.dot(y,np.log(np.clip(p,1e-12,1)))),'brier':float(((p-y)**2).sum()),'hit':int(y[order[0]]>0),'topThree':int(y[order[:3]].sum()>0)})
 model.save_model(str(out/(name+'-model.json')),format='json')
 reference=validation[-1];ref_features=[[f[i] for i in indexes] for f in reference['features']];ref_scores=model.predict(np.asarray(ref_features,float)).tolist()
 (out/(name+'-reference.json')).write_text(json.dumps({'features':ref_features,'scores':ref_scores,'date':reference['date'],'city':reference['city'],'raceNo':reference['no']}),encoding='utf8')
 results.append({'variant':name,'indexes':indexes,'metrics':{k:float(np.mean([m[k] for m in metrics])) for k in ['logLoss','brier','hit','topThree']}})
report={'phase':'validation_complete','evaluationRole':'reused_earlier_validation_diagnostic_only','parentMethod':parent['method'],'parameters':parameters,'temperature':temperature,'trainRaces':len(train),'validationRaces':len(validation),'testScored':False,'activeModelChanged':False,'addedFeatureNames':[extra['featureNames'][i-original_count] for i in added],'variants':results,'sourceSha256':extra['sourceSha256'],'trainingSha256':hashlib.sha256((root/'US/US-training.json').read_bytes()).hexdigest(),'parentReportSha256':hashlib.sha256((root/'US/report.json').read_bytes()).hexdigest(),'note':'Parent feature selection and temperature already used this validation period. This comparison is diagnostic, not independent evidence. No holdout tuning or model activation.'}
(out/'validation-report.json').write_text(json.dumps(report,indent=2),encoding='utf8');print(json.dumps(report),flush=True)
