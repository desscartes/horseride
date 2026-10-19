"""Versioned overseas data experiment; chronological validation, no automatic promotion."""
import json, sys
from pathlib import Path
from datetime import date, timedelta
import numpy as np
from catboost import CatBoostRanker, Pool

root=Path(sys.argv[1]); countries=sys.argv[2].split(',')
def read(path): return json.loads(Path(path).read_text(encoding='utf-8-sig'))
def write(path,data): Path(path).write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
def shift(day,offset): return (date.fromisoformat(day)+timedelta(days=offset)).isoformat()
reports=[]
for country in countries:
    folder=root/country; data=read(folder/f'{country}-training.json')
    rows=sorted([r for r in data['races'] if len(r['labels'])>=2 and sum(r['labels'])>0 and np.isfinite(r['features']).all()],key=lambda r:(r['date'],r['city'],r['no']))
    days=sorted({r['date'] for r in rows})
    if len(rows)<600 or not days or (date.fromisoformat(days[-1])-date.fromisoformat(days[0])).days<180:
        report={'country':country,'status':'insufficient_data','archiveRaces':len(rows),'archiveDays':len(days),'enabled':False,'shadowEnabled':False}
        write(folder/'report.json',report);reports.append(report);continue
    previous=read(root/'incumbent-US.json') if country=='US' else None
    through=days[-1]; cutoff=shift(through,-30); validation_from=shift(cutoff,-29)
    warmup=previous['train']['from'] if previous else shift(days[0],60)
    train=[r for r in rows if warmup<=r['date']<validation_from]
    validation=[r for r in rows if validation_from<=r['date']<=cutoff]
    test=[r for r in rows if r['date']>max(cutoff,previous['trainedThrough'] if previous else cutoff)]
    if len(train)<300 or len(validation)<20 or len(test)<20: raise ValueError(f'{country}: insufficient chronological split')
    names=data['featureNames']; varying=[i for i in range(len(names)) if len({f[i] for r in train for f in r['features']})>1]
    trees=previous['trees'] if previous else 300; depth=previous['depth'] if previous else 4
    def pool(races,indexes):
        x=[];y=[];groups=[]
        for g,r in enumerate(races):
            x.extend([[f[i] for i in indexes] for f in r['features']]);y.extend(r['labels']);groups.extend([g]*len(r['labels']))
        return Pool(np.asarray(x,float),np.asarray(y,float),group_id=groups)
    def fit(races,indexes):
        model=CatBoostRanker(iterations=trees,depth=depth,learning_rate=.045,loss_function='YetiRank',random_seed=42,thread_count=2,verbose=False,allow_writing_files=False)
        model.fit(pool(races,indexes));return model
    def predict(model,races,indexes):
        flat=model.predict(pool(races,indexes));out=[];offset=0
        for r in races:
            n=len(r['labels']);out.append(flat[offset:offset+n]);offset+=n
        return out
    def metrics(races,scores,temperature):
        hits=[];top3=[];brier=[];loss=[]
        for r,s in zip(races,scores):
            y=np.asarray(r['labels'],float);y/=y.sum();s=np.asarray(s)/temperature;p=np.exp(s-s.max());p/=p.sum();order=np.argsort(-p,kind='stable')
            hits.append(int(y[order[0]]>0));top3.append(int(y[order[:3]].sum()>0));brier.append(float(((p-y)**2).sum()));loss.append(float(-np.dot(y,np.log(np.clip(p,1e-12,1)))))
        return {'races':len(races),'topOne':round(float(np.mean(hits)*100),2),'winnerInTopThree':round(float(np.mean(top3)*100),2),'brier':round(float(np.mean(brier)),6),'logLoss':round(float(np.mean(loss)),6)},np.asarray(hits)
    variants=[('expanded_charts_and_pace',varying)] if country=='US' else [('country_history_and_performance',varying)]
    if country=='US': variants.append(('expanded_charts_without_pace',[i for i in varying if i<82]))
    choices=[]
    for variant,indexes in variants:
        model=fit(train,indexes);scores=predict(model,validation,indexes)
        temperature=float(min(np.geomspace(.15,8,40),key=lambda t:metrics(validation,scores,t)[0]['logLoss']))
        score=metrics(validation,scores,temperature)[0]['logLoss'];choices.append((score,variant,indexes,temperature))
    _,variant,indexes,temperature=min(choices,key=lambda x:x[0])
    fit_rows=[r for r in rows if warmup<=r['date']<=cutoff]
    test_model=fit(fit_rows,indexes);candidate,candidate_hits=metrics(test,predict(test_model,test,indexes),temperature)
    if previous:
        control=read(root/'control'/'US-training.json');lookup={(r['date'],r['city'],r['no']):r for r in control['races']}
        prior_rows=[]
        for r in test:
            old=lookup[(r['date'],r['city'],r['no'])]
            if r['horses']!=old['horses'] or r['labels']!=old['labels']: raise ValueError('Incumbent field/label alignment failed')
            prior_rows.append(old)
        old_model=CatBoostRanker();old_model.load_model(previous['modelPath'],format='json')
        incumbent,incumbent_hits=metrics(prior_rows,predict(old_model,prior_rows,previous['featureIndexes']),previous['temperature'])
        comparator='active_US_model_with_its_own_frozen_chart_input'
    else:
        baseline=[np.log(np.clip(np.asarray(r['baseline'],float)/100,1e-12,1)) for r in test]
        incumbent,incumbent_hits=metrics(test,baseline,1);comparator='existing_program_baseline'
    delta=candidate_hits-incumbent_hits;test_days=sorted({r['date'] for r in test})
    blocks=[delta[[i for i,r in enumerate(test) if r['date']==day]] for day in test_days];rng=np.random.default_rng(42)
    bootstrap=[np.concatenate([blocks[i] for i in rng.integers(0,len(blocks),len(blocks))]).mean()*100 for _ in range(1000)]
    bounds=np.quantile(bootstrap,[.025,.975])
    test_model.save_model(str(folder/'test.json'),format='json')
    live_rows=[r for r in rows if r['date']>=warmup];live=fit(live_rows,indexes);live.save_model(str(folder/'live.json'),format='json')
    sample=rows[-1];reference=predict(live,[sample],indexes)[0]
    write(folder/'reference.json',{'date':sample['date'],'city':sample['city'],'raceNo':sample['no'],'horses':sample['horses'],'features':sample['features'],'scores':reference.tolist()})
    evaluation={'races':len(test),'days':len(test_days),'testFrom':test_days[0],'testThrough':test_days[-1],'candidateTrainedThrough':cutoff,'incumbentTrainedThrough':previous['trainedThrough'] if previous else None,'candidate':candidate,'incumbent':incumbent,'comparator':comparator,'improvementPoints':round(candidate['topOne']-incumbent['topOne'],2),'dayBootstrap95':[round(float(n),3) for n in bounds]}
    report={'country':country,'status':'overseas_data_candidate','method':f'local_catboost_performance_{country}_overseas_v1_{through.replace("-","")}','featurePipeline':'performance_v2' if country=='US' else 'performance_v1','identityVersion':data.get('identityVersion',1),'featureIndexes':indexes,'featureNames':[names[i] for i in indexes],'temperature':temperature,'depth':depth,'trees':trees,'trainedThrough':through,'archiveRaces':len(rows),'archiveDays':len(days),'liveTrainingRaces':len(live_rows),'train':{'from':warmup,'through':cutoff,'races':len(fit_rows)},'validation':{'from':validation_from,'through':cutoff,'races':len(validation)},'featureVariant':variant,'validationChoices':[{'variant':v,'logLoss':s} for s,v,_,_ in choices],'evaluation':evaluation,'enabled':False,'promoted':False,'shadowEnabled':True,'externalChartsPath':str(root/'charts.json').replace('\\','/'),'trainingDataPath':str(folder/f'{country}-training.json').replace('\\','/'),'inputs':['horse_history','jockey','trainer','rivals','past_speed_class']+(['expanded_official_charts','verified_prior_pace'] if country=='US' and variant=='expanded_charts_and_pace' else ['expanded_official_charts'] if country=='US' else []),'note':'New versioned data experiment. Hyperparameters fixed; feature variant and temperature selected only on earlier validation days. Retrospective comparison; not proof of future gain. Held for prospective evaluation.'}
    importance=live.get_feature_importance(type='PredictionValuesChange');report['featureImportance']=[{'name':names[i],'importance':round(float(v),4)} for i,v in zip(indexes,importance)]
    write(folder/'report.json',report);reports.append(report)
    print(json.dumps({'country':country,'variant':variant,'evaluation':evaluation}),flush=True)
write(root/'training-report.json',{'countries':reports})
