"""Chronological country specialists; research only. Never writes to live models."""
import json,sys
from pathlib import Path
import numpy as np
from catboost import CatBoostRanker,Pool

project,country,input_path,output=sys.argv[1:5]
project=Path(project);root=Path(output);root.mkdir(parents=True,exist_ok=True)
report_path=project/('data/ranking-report.json' if country=='TR' else 'data/foreign-models/US-report.json')
previous=json.loads(report_path.read_text(encoding='utf-8-sig'))
data=json.loads(Path(input_path).read_text(encoding='utf-8-sig'));names=data['featureNames']
assert not any(n.lower() in ['agf','marketshare','closingodds','probability'] for n in names)
rows=sorted([r for r in data['races'] if previous['train']['from']<=r['date']<=previous['trainedThrough']],key=lambda r:(r['date'],r['city'],r['no']))
train=[r for r in rows if r['date']<previous['validation']['from']]
val=[r for r in rows if previous['validation']['from']<=r['date']<previous['test']['from']]
diagnostic=[r for r in rows if r['date']>=previous['test']['from']]
assert max(r['date'] for r in train)<min(r['date'] for r in val)<min(r['date'] for r in diagnostic)
indices=[i for i in range(len(names)) if len({f[i] for r in train for f in r['features']})>1]
def pool(rs,ix):
    x=[];y=[];g=[]
    for n,r in enumerate(rs):
        x.extend([[f[i] for i in ix] for f in r['features']]);y.extend(r['labels']);g.extend([n]*len(r['labels']))
    return Pool(np.asarray(x,float),y,group_id=g)
def predict(model,rs,ix):
    flat=model.predict(pool(rs,ix));out=[];offset=0
    for r in rs:
        count=len(r['labels']);out.append(flat[offset:offset+count]);offset+=count
    return out
def probabilities(values,temp):
    out=[]
    for v in values:
        s=np.asarray(v)/temp;p=np.exp(s-s.max());out.append(p/p.sum())
    return out
def metrics(rs,ps):
    hit=[];loss=[];brier=[]
    for r,p in zip(rs,ps):
        y=np.asarray(r['labels'],float);y/=y.sum();hit.append(int(y[np.argmax(p)]>0));loss.append(float(-np.dot(y,np.log(np.clip(p,1e-12,1)))));brier.append(float(((p-y)**2).sum()))
    return {'races':len(rs),'topOne':round(float(np.mean(hit))*100,2),'logLoss':round(float(np.mean(loss)),6),'brier':round(float(np.mean(brier)),6)}
base=CatBoostRanker();base.load_model(str(project/('data/ranking-performance-test-v4.json' if country=='TR' else 'data/foreign-models/US-test.json')),format='json')
assert all(names[i]==n for i,n in zip(previous['featureIndexes'],previous['featureNames']))
def baseline(rs):return probabilities(predict(base,rs,previous['featureIndexes']),previous['temperature'])
def value(r,n):return r['features'][0][names.index(n)]
groups={'maiden':lambda r:value(r,'maiden')==1,'turf':lambda r:value(r,'turf')==1,'dirt':lambda r:value(r,'turf')==0 and value(r,'synthetic')==0,'synthetic':lambda r:value(r,'synthetic')==1,'short':lambda r:value(r,'distance')<=1400,'medium':lambda r:1400<value(r,'distance')<=1800,'long':lambda r:value(r,'distance')>1800}
result={'country':country,'enabled':False,'diagnosticsPreviouslyInspected':True,'specialists':[],'selection':'Validation only; separate, overlapping specialist experiments. No overlapping models combined or deployed.','futureRequirement':'Freeze candidate before future races; compare on matched pre-start snapshots, include coverage.'}
for name,predicate in groups.items():
    tr=[r for r in train if predicate(r)];va=[r for r in val if predicate(r)];te=[r for r in diagnostic if predicate(r)]
    entry={'name':name,'trainingRaces':len(tr),'validationRaces':len(va),'diagnosticRaces':len(te)}
    if len(tr)<600 or len(va)<150 or len(te)<100:
        entry['status']='insufficient_samples';result['specialists'].append(entry);continue
    model=CatBoostRanker(iterations=350,depth=4,learning_rate=.045,loss_function='YetiRank',eval_metric='NDCG:top=1',random_seed=42,thread_count=2,allow_writing_files=False,verbose=False)
    model.fit(pool(tr,indices),eval_set=pool(va,indices),early_stopping_rounds=50)
    values=predict(model,va,indices)
    temp=float(min(np.geomspace(.2,6,25),key=lambda t:metrics(va,probabilities(values,t))['logLoss']))
    bp=baseline(va);sp=probabilities(values,temp)
    choices=[(w,metrics(va,[(1-w)*b+w*s for b,s in zip(bp,sp)])) for w in [0,.25,.5,.75,1]]
    weight,m=max(choices,key=lambda c:(c[1]['topOne'],-c[1]['logLoss']))
    db=baseline(te);ds=probabilities(predict(model,te,indices),temp)
    entry.update(status='research_only',weight=weight,trees=model.tree_count_,temperature=temp,featureIndexes=indices,validation=m,validationBaseline=metrics(va,bp),diagnostic=metrics(te,[(1-weight)*b+weight*s for b,s in zip(db,ds)]),diagnosticBaseline=metrics(te,db))
    model.save_model(str(root/f'{name}-diagnostic.json'),format='json')
    result['specialists'].append(entry)
    print(json.dumps({k:v for k,v in entry.items() if k!='featureIndexes'}),flush=True)
    (root/'report.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
(root/'report.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
