"""Paired pedigree ablation, chronological validation, and prospective gate.
Uses official archived parent identities, not current career totals.
Never edits the active model. CPU work is limited to two threads.
"""
import json, sys
from pathlib import Path
from datetime import date, timedelta
import numpy as np
from catboost import CatBoostRanker, Pool

root=Path(sys.argv[1]); previous=json.loads(Path(sys.argv[2]).read_text(encoding='utf-8-sig'))
data=json.loads((root/'TR-training.json').read_text(encoding='utf-8'))
rows=sorted(data['races'],key=lambda r:(r['date'],r['city'],r['no']))
names=data['featureNames']; base=previous['featureIndexes']
if any(names[i]!=n for i,n in zip(base,previous['featureNames'])):
    raise ValueError('Incumbent feature schema mismatch')
start=names.index('missingSire'); extended=base+list(range(start,len(names)))
train=[r for r in rows if previous['train']['from']<=r['date']<previous['validation']['from']]
validation=[r for r in rows if previous['validation']['from']<=r['date']<previous['test']['from']]
test=[r for r in rows if previous['test']['from']<=r['date']<=previous['trainedThrough']]
if len(train)<300 or len(validation)<100 or len(test)<300:
    raise ValueError('Insufficient chronological archive')
def pool(races,indexes):
    x=[];y=[];g=[]
    for i,r in enumerate(races):
        x.extend([[f[j] for j in indexes] for f in r['features']]);y.extend(r['labels']);g.extend([i]*len(r['labels']))
    return Pool(x,y,group_id=g,feature_names=[names[j] for j in indexes])
def fit(races,indexes):
    m=CatBoostRanker(iterations=previous['trees'],depth=previous['depth'],learning_rate=.045,loss_function='YetiRank',random_seed=42,thread_count=2,verbose=False,allow_writing_files=False)
    m.fit(pool(races,indexes));return m
def predict(m,races,indexes):
    flat=m.predict(pool(races,indexes));result=[];offset=0
    for r in races:
        n=len(r['labels']);result.append(np.asarray(flat[offset:offset+n]));offset+=n
    return result
def metrics(races,scores,t):
    hits=[];top3=[];brier=[];loss=[]
    for r,s in zip(races,scores):
        y=np.asarray(r['labels'],float);y/=y.sum();s=s/t;p=np.exp(s-s.max());p/=p.sum();order=np.argsort(-p,kind='stable')
        hits.append(int(y[order[0]]>0));top3.append(int(y[order[:3]].sum()>0));brier.append(float(((p-y)**2).sum()));loss.append(float(-np.dot(y,np.log(np.clip(p,1e-12,1)))))
    return {'races':len(races),'topOne':round(float(np.mean(hits)*100),2),'winnerInTopThree':round(float(np.mean(top3)*100),2),'brier':round(float(np.mean(brier)),6),'logLoss':round(float(np.mean(loss)),6)},np.asarray(hits)
def calibrate(m,indexes):
    vs=predict(m,validation,indexes)
    return float(min(np.geomspace(.15,8,50),key=lambda t:metrics(validation,vs,t)[0]['logLoss']))
def comparison(races,c,old,ct,ot):
    cm,ch=metrics(races,c,ct);om,oh=metrics(races,old,ot)
    days=sorted({r['date'] for r in races});delta=ch-oh
    blocks=[delta[[i for i,r in enumerate(races) if r['date']==d]] for d in days]
    rng=np.random.default_rng(42)
    bounds=np.quantile([np.concatenate([blocks[i] for i in rng.integers(0,len(blocks),len(blocks))]).mean()*100 for _ in range(1500)],[.025,.975])
    return {'races':len(races),'days':len(days),'testFrom':days[0],'testThrough':days[-1],'candidate':cm,'incumbent':om,'improvementPoints':round(cm['topOne']-om['topOne'],2),'dayBootstrap95':[round(float(v),3) for v in bounds]}

print('Training paired models with fixed incumbent parameters',flush=True)
candidate=fit(train,extended);control=fit(train,base)
temperature=calibrate(candidate,extended);control_temperature=calibrate(control,base)
retrospective=comparison(test,predict(candidate,test,extended),predict(control,test,base),temperature,control_temperature)
print(json.dumps({'retrospectiveAblation':retrospective}),flush=True)
candidate.save_model(str(root/'test.json'),format='json')
importance=candidate.get_feature_importance(type='PredictionValuesChange')
feature_importance=[{'name':names[i],'importance':round(float(v),4)} for i,v in zip(extended,importance)]
through=rows[-1]['date'];cutoff=(date.fromisoformat(through)-timedelta(days=30)).isoformat()
forward=[r for r in rows if r['date']>previous['trainedThrough'] and r['date']>cutoff]
evaluation=None
if forward:
    past=[r for r in rows if previous['train']['from']<=r['date']<=cutoff]
    if len(past)>=300:
        challenger=fit(past,extended)
        incumbent=CatBoostRanker();incumbent.load_model(sys.argv[3],format='json')
        evaluation=comparison(forward,predict(challenger,forward,extended),predict(incumbent,forward,base),temperature,previous['temperature'])
        evaluation.update(candidateTrainedThrough=cutoff,incumbentTrainedThrough=previous['trainedThrough'])

live_rows=[r for r in rows if r['date']>=previous['train']['from']]
live=fit(live_rows,extended);live.save_model(str(root/'live.json'),format='json')
sample=live_rows[-1];scores=predict(live,[sample],extended)[0]
(root/'reference.json').write_text(json.dumps({'features':sample['features'],'scores':scores.tolist()}),encoding='utf-8')
flat=[f for r in rows for f in r['features']]
at=lambda n:names.index(n)
coverage={'runners':len(flat),'withSire':sum(f[at('missingSire')]==0 for f in flat),'withDam':sum(f[at('missingDam')]==0 for f in flat),'withDamsire':sum(f[at('missingDamsire')]==0 for f in flat),'withKnownGoing':sum(f[at('missingPedigreeGoing')]==0 for f in flat),'withSireSurfaceRelatives':sum(f[at('sireSurfaceOffspring')]>=2 for f in flat),'withSireGoingRelatives':sum(f[at('sireGoingOffspring')]>=2 for f in flat)}
report={**previous,'country':'TR','method':'local_catboost_pedigree_TR_'+through.replace('-',''),'featurePipeline':'pedigree_v1','featureNames':[names[i] for i in extended],'featureIndexes':extended,'temperature':temperature,'trainedThrough':through,'enabled':False,'promoted':False,'shadowEnabled':True,'status':'pedigree_candidate','liveTrainingRaces':len(live_rows),'retrospectiveAblation':retrospective,'evaluation':evaluation,'featureImportance':feature_importance,'pedigreeImportance':round(sum(v['importance'] for v in feature_importance if v['name'] in names[start:]),4),'pedigreeCoverage':coverage,'inputs':previous['inputs']+['sire_family','dam_family','maternal_grandsire_family','pedigree_surface_distance','pedigree_going_temperature'],'trainingDataPath':str(root/'TR-training.json'),'testModelPath':str(root/'test.json'),'dailyModelPath':str(root/'live.json'),'note':'Previously inspected historical period is exploratory, not an independent blind test. Fixed paired ablation, previous-day results only, own results excluded from family aggregates, unknown going remains unknown. Live promotion requires prospective evidence; no guaranteed accuracy gain.'}
report.pop('test',None);report.pop('incumbent',None);report.pop('withoutPerformance',None)
report.pop('validationChoices',None);report.pop('dailyTraining',None)
report['archiveRaces']=len(rows);report['archiveDays']=len({r['date'] for r in rows})
report['deploymentStatus']='shadow_validation'
for stale in ['prospectiveEvidence','verifiedArtifactSha256','fullRuntimeFeatureParity']:
    report.pop(stale,None)
report['prospectiveRequired']=True
report['evaluationRole']='retrospective_reused_holdout_requires_prospective'
(root/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'coverage':coverage,'pedigreeImportance':report['pedigreeImportance'],'evaluation':evaluation}),flush=True)
