"""Fixed chronological objective experiment. Research files only; never deploys."""
import json,sys,os
from pathlib import Path
project=Path(sys.argv[4]) if len(sys.argv)>4 else Path.cwd()
sys.path.insert(0,str(project/'.tools/ml-python'))
import numpy as np
from catboost import CatBoostRanker,Pool
country,input_path,output=sys.argv[1:4]
root=Path(output);root.mkdir(parents=True,exist_ok=True)
previous=json.loads((project/('data/ranking-report.json' if country=='TR' else 'data/foreign-models/US-report.json')).read_text(encoding='utf-8-sig'))
data=json.loads(Path(input_path).read_text(encoding='utf-8-sig')); names=data['featureNames']
assert not any('agf' in n.lower() or n in ['marketShare','closingOdds','probability'] for n in names)
races=sorted([r for r in data['races'] if r['date']>=previous['train']['from']],key=lambda r:(r['date'],r['city'],r['no']))
train=[r for r in races if r['date']<previous['validation']['from']]
val=[r for r in races if previous['validation']['from']<=r['date']<previous['test']['from']]
test=[r for r in races if previous['test']['from']<=r['date']<=previous['trainedThrough']]
fresh=[r for r in races if r['date']>previous['trainedThrough']]
baseline_data=json.loads(Path(sys.argv[5]).read_text(encoding='utf-8-sig')) if len(sys.argv)>5 else data
baseline_rows={(r['date'],r['city'],r['no']):r for r in baseline_data['races']}
def original_rows(rows):return [baseline_rows[(r['date'],r['city'],r['no'])] for r in rows]
indexes=[i for i in range(len(names)) if len({f[i] for r in train for f in r['features']})>1]
assert train and val and test and max(r['date'] for r in train)<min(r['date'] for r in val)<min(r['date'] for r in test)
def pool(rows,indices=indexes):
 x=[];y=[];g=[]
 for i,r in enumerate(rows):
  x.extend([[f[j] for j in indices] for f in r['features']]);y.extend(r['labels']);g.extend([i]*len(r['labels']))
 return Pool(np.asarray(x,float),y,group_id=g)
def scores(model,rows,indices=indexes):
 flat=model.predict(pool(rows,indices));out=[];offset=0
 for r in rows:
  n=len(r['labels']);out.append(flat[offset:offset+n]);offset+=n
 return out
def metric(rows,values,temp=1):
 hits=[];top3=[];brier=[];loss=[];favorite_hits=[];agreement=[];different_hits=[]
 for r,s in zip(rows,values):
  y=np.asarray(r['labels'],float);y/=y.sum();s=np.asarray(s)/temp;p=np.exp(s-s.max());p/=p.sum();order=np.argsort(-p,kind='stable');hit=int(y[order[0]]>0)
  hits.append(hit);top3.append(int(y[order[:3]].sum()>0));brier.append(float(((p-y)**2).sum()));loss.append(float(-np.dot(y,np.log(np.clip(p,1e-12,1)))))
  odds=[float(o) if o and float(o)>0 else np.inf for o in r.get('odds',[])]
  if odds and np.isfinite(odds).any():
   favorite=int(np.argmin(odds));favorite_hits.append(int(y[favorite]>0));agreement.append(int(order[0]==favorite))
   if order[0]!=favorite:different_hits.append(hit)
 if not rows:return None
 return {'races':len(rows),'topOne':round(np.mean(hits)*100,2),'winnerInTopThree':round(np.mean(top3)*100,2),'brier':round(np.mean(brier),6),'logLoss':round(np.mean(loss),6),'closingFavoriteRate':round(np.mean(favorite_hits)*100,2) if favorite_hits else None,'closingFavoriteAgreement':round(np.mean(agreement)*100,2) if agreement else None,'differentFromFavoriteRaces':len(different_hits),'differentFromFavoriteTopOne':round(np.mean(different_hits)*100,2) if different_hits else None}
choices=[]
for objective,depth in [('YetiRank',4),('QuerySoftMax',4),('QuerySoftMax',6)]:
 model=CatBoostRanker(iterations=650,depth=depth,learning_rate=.045,loss_function=objective,eval_metric='NDCG:top=1',random_seed=42,thread_count=2,verbose=False,allow_writing_files=False)
 model.fit(pool(train),eval_set=pool(val),early_stopping_rounds=70)
 vs=scores(model,val);temp=float(min(np.geomspace(.15,8,40),key=lambda t:metric(val,vs,t)['logLoss']))
 m=metric(val,vs,temp);choices.append((m['topOne'],-m['logLoss'],model,temp,objective,depth,m))
 print(json.dumps({'country':country,'phase':'validation','objective':objective,'depth':depth,'trees':model.tree_count_,'metrics':m}),flush=True)
selected=max(choices,key=lambda c:c[:2]);_,_,model,temp,objective,depth,vm=selected
candidate=metric(test,scores(model,test),temp)
incumbent=CatBoostRanker();incumbent.load_model(str(project/('data/ranking-performance-test-v4.json' if country=='TR' else 'data/foreign-models/US-test.json')),format='json')
baseline=metric(test,scores(incumbent,original_rows(test),previous['featureIndexes']),previous['temperature'])
# Refit fixed validation-selected settings through the incumbent's last training day.
# Both prospective comparators then have the same cutoff; never select on fresh dates.
fresh_model=CatBoostRanker(iterations=model.tree_count_,depth=depth,learning_rate=.045,loss_function=objective,random_seed=42,thread_count=2,verbose=False,allow_writing_files=False)
fresh_model.fit(pool([r for r in races if r['date']<=previous['trainedThrough']]))
fresh_model.save_model(str(root/'candidate-pre-fresh.json'),format='json')
new_candidate=metric(fresh,scores(fresh_model,fresh),temp) if fresh else None
incumbent_live=CatBoostRanker();incumbent_live.load_model(str(project/('data/ranking-live.json' if country=='TR' else 'data/foreign-models/US-live.json')),format='json')
new_incumbent=metric(fresh,scores(incumbent_live,original_rows(fresh),previous['featureIndexes']),previous['temperature']) if fresh else None
model.save_model(str(root/'candidate-test.json'),format='json')
report={'country':country,'enabled':False,'selectedObjective':objective,'depth':depth,'trees':model.tree_count_,'temperature':temp,'featureIndexes':indexes,'featureNames':[names[i] for i in indexes],'validation':vm,'validationChoices':[{'objective':c[4],'depth':c[5],'metrics':c[6]} for c in choices],'diagnosticTest':{'from':test[0]['date'],'through':test[-1]['date'],'candidate':candidate,'incumbent':baseline},'newDates':{'candidate':new_candidate,'incumbent':new_incumbent,'bothTrainedThrough':previous['trainedThrough'],'from':fresh[0]['date'] if fresh else None,'through':fresh[-1]['date'] if fresh else None},'constantTrainingFeatures':[names[i] for i in range(len(names)) if i not in indexes],'note':'No market inputs. Selected only by validation top-one then logloss. Historical test was previously inspected; diagnostics are not new blind evidence. New-date sample can be small. Never deployed automatically.'}
(root/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k not in ['featureNames','featureIndexes','validationChoices']},ensure_ascii=False),flush=True)
