"""Local CPU training. No AI/API requests. Chronological train/validation/test."""
import json, math, os, sys
from pathlib import Path
sys.path.insert(0, str(Path('.tools/ml-python').resolve()))
import numpy as np
from catboost import CatBoostRanker, Pool

data=json.loads(Path('data/training-races.json').read_text(encoding='utf-8'))
all_races=data['races']
days=sorted({r['date'] for r in all_races})
if len(days)<180: raise RuntimeError('At least 180 archive days are required before promotion testing')
collection=json.loads(Path('data/training-workouts/collection-report.json').read_text(encoding='utf-8'))
if collection['completed']/collection['total']<.95: raise RuntimeError('At least 95% of workout archive dates must be fully collected')
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
previous_model=CatBoostRanker()
previous_model.load_model('data/models/v1/ranking-test.json',format='json')
previous_report=json.loads(Path('data/models/v1/ranking-report.json').read_text(encoding='utf-8'))
previous_scores=previous_model.predict(np.asarray([f[:35] for r in test for f in r['features']],dtype=float))
previous_by_race=[];offset=0
for r in test:
    n=len(r['labels']);previous_by_race.append(previous_scores[offset:offset+n]);offset+=n
previous=metrics(test,previous_by_race,previous_report['temperature'])
market=[]
for r in test:
    odds=np.asarray([v if v and v>0 else math.inf for v in r['odds']])
    market.append(int(r['labels'][int(np.argmin(odds))]) if np.isfinite(odds).any() else None)
paired=np.asarray(candidate['hits'])-np.asarray(previous['hits'])
rng=np.random.default_rng(42)
bootstrap=np.asarray([np.mean(rng.choice(paired,len(paired),replace=True))*100 for _ in range(1500)])
lower,upper=np.quantile(bootstrap,[.025,.975])
improvement=candidate['topOne']-baseline['topOne']
improvement_previous=candidate['topOne']-previous['topOne']
promoted=bool(len(test)>=300 and improvement_previous>=0 and candidate['brier']<previous['brier'])
report={'method':'local_catboost_workout_weather_v2','featureNames':data['featureNames'],'archiveDays':len(days),'archiveRaces':len(all_races),'train':{'from':days[60],'through':train[-1]['date'],'races':len(train)},'validation':{'from':train_end,'through':validation[-1]['date'],'races':len(validation),**{k:v for k,v in validation_metrics.items() if k!='hits'}},'test':{'from':validation_end,'through':test[-1]['date'],'candidate':{k:v for k,v in candidate.items() if k!='hits'},'baseline':{k:v for k,v in baseline.items() if k!='hits'},'previous':{k:v for k,v in previous.items() if k!='hits'},'closingFavoriteRate':round(np.mean([v for v in market if v is not None])*100,2),'improvementPoints':round(improvement,2),'improvementVsPrevious':round(improvement_previous,2),'pairedBootstrap95VsPrevious':[round(float(lower),2),round(float(upper),2)],'significantVsPrevious':bool(lower>0)},'temperature':temperature,'depth':depth,'trees':model.tree_count_,'promoted':promoted,'trainedThrough':days[-1],'prospective':False,'inputs':['horse_history','jockey','rivals','workouts','official_weather','official_going'],'note':'Retrospective v2 comparison on the previously inspected period, not a new blind test. Weather is archived official meeting weather, not a historical forecast. No market odds used. New prospective data is needed to establish a reliable improvement.'}
model.save_model('data/ranking-environment-test.json',format='json')
importance=model.get_feature_importance(type='PredictionValuesChange')
report['featureImportance']=sorted([{'name':name,'importance':round(float(value),3)} for name,value in zip(data['featureNames'],importance)],key=lambda row:-row['importance'])
report['unusedFeatures']=[row['name'] for row in report['featureImportance'] if row['importance']==0]
workout_names={name for name in data['featureNames'] if name.lower().startswith('workout') or name=='missingWorkout'}
weather_names=set(data['featureNames'][35:48])
report['groupImportance']={'workouts':round(sum(float(v) for n,v in zip(data['featureNames'],importance) if n in workout_names),3),'weather':round(sum(float(v) for n,v in zip(data['featureNames'],importance) if n in weather_names),3)}
report['ablation']={}
for label,excluded in [('withoutWorkouts',workout_names),('withoutWeather',weather_names)]:
    indexes=[i for i,name in enumerate(data['featureNames']) if name not in excluded]
    def masked_pool(races):
        x=[];y=[];groups=[]
        for group,r in enumerate(races):
            x.extend([[f[i] for i in indexes] for f in r['features']]);y.extend(r['labels']);groups.extend([group]*len(r['labels']))
        return Pool(np.asarray(x,dtype=float),np.asarray(y,dtype=float),group_id=groups,feature_names=[data['featureNames'][i] for i in indexes])
    control=CatBoostRanker(iterations=model.tree_count_,depth=depth,learning_rate=.045,loss_function='YetiRank',random_seed=42,thread_count=4,verbose=False,allow_writing_files=False)
    control.fit(masked_pool(train))
    def control_scores(races):
        predictions=control.predict(masked_pool(races));offset=0;rows=[]
        for r in races:
            n=len(r['labels']);rows.append(predictions[offset:offset+n]);offset+=n
        return rows
    validation_scores=control_scores(validation)
    control_temperature=float(min(np.geomspace(.15,8,70),key=lambda t:metrics(validation,validation_scores,t)['logLoss']))
    comparison=metrics(test,control_scores(test),control_temperature)
    report['ablation'][label]={k:v for k,v in comparison.items() if k!='hits'}
report['workoutCollection']=collection
report['featureCoverage']={'runners':sum(len(r['labels']) for r in all_races),'withRecentWorkout':sum(f[34]==0 for r in all_races for f in r['features']),'withTemperature':sum(f[41]==0 for r in all_races for f in r['features'])}
report['promoted']=bool(report['promoted'] and report['groupImportance']['workouts']>0 and report['groupImportance']['weather']>0)
enabled=report['promoted']
report['enabled']=enabled
report['promoted']=bool(enabled and lower>0 and improvement_previous>=2)
report['deploymentStatus']='validated_promotion' if report['promoted'] else 'prospective_trial' if enabled else 'rejected'
report['activationNote']='Trial enabled only with non-decreasing retrospective top-one, lower Brier, and both feature groups learned. Statistically reliable promotion additionally requires >=2 points and a positive bootstrap lower bound.'
report['liveTrainingRaces']=sum(r['date']>=days[60] for r in all_races)
Path('data/ranking-reference.json').write_text(json.dumps({'features':test[0]['features'],'scores':scores[0].tolist()}),encoding='utf-8')
if enabled:
    live=CatBoostRanker(iterations=model.tree_count_,depth=depth,learning_rate=.045,loss_function='YetiRank',random_seed=42,thread_count=4,verbose=False,allow_writing_files=False)
    live.fit(pool([r for r in all_races if r['date']>=days[60]]))
    live.save_model('data/ranking-live.json',format='json')
Path('data/ranking-environment-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
if enabled or not Path('data/ranking-report.json').exists():
    Path('data/ranking-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False),flush=True)
