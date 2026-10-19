"""Local CPU training. No AI/API requests. Chronological train/validation/test."""
import json, math, os, sys
from pathlib import Path
sys.path.insert(0, str(Path('.tools/ml-python').resolve()))
import numpy as np
from catboost import CatBoostRanker, Pool

data=json.loads(Path('data/training-races.json').read_text(encoding='utf-8'))
# Keep the original v1 experiment reproducible after enriched v2 exports.
data['featureNames']=data['featureNames'][:35]
for race in data['races']:
    for i,features in enumerate(race['features']):
        race['features'][i]=features[:35]
        for index,value in [(28,0),(29,999),(30,0),(31,0),(34,1)]:race['features'][i][index]=value
all_races=data['races']
days=sorted({r['date'] for r in all_races})
if len(days)<180: raise RuntimeError('At least 180 archive days are required before promotion testing')
# First 60 days build history; no claim that cold-start rows are representative.
eligible=days[60:]
train_end=eligible[int(len(eligible)*.60)]
validation_end=eligible[int(len(eligible)*.80)]
train=[r for r in all_races if days[60]<=r['date']<train_end]
validation=[r for r in all_races if train_end<=r['date']<validation_end]
test=[r for r in all_races if r['date']>=validation_end]

def pool(races):
    x=[];y=[];groups=[]
    for group,r in enumerate(races):
        x.extend(r['features']);y.extend(r['labels']);groups.extend([group]*len(r['labels']))
    return Pool(np.asarray(x,dtype=float),np.asarray(y,dtype=float),group_id=groups,feature_names=data['featureNames'])

def scores_by_race(model,races):
    predictions=model.predict(pool(races));result=[];offset=0
    for r in races:
        n=len(r['labels']);result.append(predictions[offset:offset+n]);offset+=n
    return result

def softmax(scores,temperature):
    scores=np.asarray(scores,dtype=float)/temperature
    p=np.exp(scores-np.max(scores));return p/p.sum()

def metrics(races,scores,temperature):
    hits=[];first3=[];brier=[];loss=[]
    for r,s in zip(races,scores):
        y=np.asarray(r['labels'],dtype=float);y=y/y.sum();p=softmax(s,temperature)
        order=np.argsort(-p,kind='stable')
        hits.append(int(y[order[0]]>0));first3.append(int(y[order[:3]].sum()>0))
        brier.append(float(((p-y)**2).sum()));loss.append(float(-np.dot(y,np.log(np.clip(p,1e-12,1)))))
    return {'races':len(races),'topOne':round(np.mean(hits)*100,2),'winnerInTopThree':round(np.mean(first3)*100,2),'brier':round(np.mean(brier),5),'logLoss':round(np.mean(loss),5),'hits':hits}

models=[]
for depth in [4,6]:
    model=CatBoostRanker(iterations=700,depth=depth,learning_rate=.045,loss_function='YetiRank',random_seed=42,thread_count=4,verbose=False,allow_writing_files=False)
    model.fit(pool(train),eval_set=pool(validation),early_stopping_rounds=70)
    scores=scores_by_race(model,validation)
    temperatures=np.geomspace(.15,8,70)
    temperature=float(min(temperatures,key=lambda t:metrics(validation,scores,t)['logLoss']))
    summary=metrics(validation,scores,temperature)
    models.append((summary['logLoss'],model,temperature,depth,summary))
    print(json.dumps({'depth':depth,'validation':{k:v for k,v in summary.items() if k!='hits'},'trees':model.tree_count_}),flush=True)
_,model,temperature,depth,validation_metrics=min(models,key=lambda item:item[0])
scores=scores_by_race(model,test)
candidate=metrics(test,scores,temperature)
baseline_scores=[np.log(np.clip(np.asarray(r['baseline'])/100,1e-12,1)) for r in test]
baseline=metrics(test,baseline_scores,1)
market=[]
for r in test:
    odds=np.asarray([v if v and v>0 else math.inf for v in r['odds']])
    market.append(int(r['labels'][int(np.argmin(odds))]) if np.isfinite(odds).any() else None)
paired=np.asarray(candidate['hits'])-np.asarray(baseline['hits'])
rng=np.random.default_rng(42)
bootstrap=np.asarray([np.mean(rng.choice(paired,len(paired),replace=True))*100 for _ in range(1500)])
lower,upper=np.quantile(bootstrap,[.025,.975])
improvement=candidate['topOne']-baseline['topOne']
promoted=bool(len(test)>=300 and improvement>=2 and lower>0 and candidate['brier']<baseline['brier'])
report={'method':'local_catboost_numeric_ranking_v1','featureNames':data['featureNames'],'archiveDays':len(days),'archiveRaces':len(all_races),'train':{'from':days[60],'through':train[-1]['date'],'races':len(train)},'validation':{'from':train_end,'through':validation[-1]['date'],'races':len(validation),**{k:v for k,v in validation_metrics.items() if k!='hits'}},'test':{'from':validation_end,'through':test[-1]['date'],'candidate':{k:v for k,v in candidate.items() if k!='hits'},'baseline':{k:v for k,v in baseline.items() if k!='hits'},'closingFavoriteRate':round(np.mean([v for v in market if v is not None])*100,2),'improvementPoints':round(improvement,2),'pairedBootstrap95':[round(float(lower),2),round(float(upper),2)]},'temperature':temperature,'depth':depth,'trees':model.tree_count_,'promoted':promoted,'trainedThrough':days[-1],'prospective':False,'note':'Historical archive experiment; prospective performance is recorded separately. No market odds were used as features.'}
model.save_model('data/ranking-test.json',format='json')
importance=model.get_feature_importance(type='PredictionValuesChange')
report['featureImportance']=sorted([{'name':name,'importance':round(float(value),3)} for name,value in zip(data['featureNames'],importance)],key=lambda row:-row['importance'])
report['unusedFeatures']=[row['name'] for row in report['featureImportance'] if row['importance']==0]
report['liveTrainingRaces']=sum(r['date']>=days[60] for r in all_races)
Path('data/ranking-reference.json').write_text(json.dumps({'features':test[0]['features'],'scores':scores[0].tolist()}),encoding='utf-8')
if promoted:
    live=CatBoostRanker(iterations=model.tree_count_,depth=depth,learning_rate=.045,loss_function='YetiRank',random_seed=42,thread_count=4,verbose=False,allow_writing_files=False)
    live.fit(pool([r for r in all_races if r['date']>=days[60]]))
    live.save_model('data/ranking-live.json',format='json')
Path('data/ranking-experiment-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
if promoted or not Path('data/ranking-report.json').exists():
    Path('data/ranking-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False),flush=True)
