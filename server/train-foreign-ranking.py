"""Independent country experiments; no paid API, no automatic deployment."""
import json, sys, os
from datetime import date,timedelta
from pathlib import Path
sys.path.insert(0,str(Path('.tools/ml-python').resolve()))
import numpy as np
from catboost import CatBoostRanker,Pool

root=Path(os.environ.get('FOREIGN_MODEL_DIR','data/foreign-models'))
reports=[]
for path in sorted(root.glob('*-training.json')):
    data=json.loads(path.read_text(encoding='utf-8'));races=data['races'];days=sorted({r['date'] for r in races})
    if os.environ.get('TRAIN_COUNTRIES') and data['country'] not in os.environ['TRAIN_COUNTRIES'].split(','):continue
    report={'country':data['country'],'archiveRaces':len(races),'archiveDays':len(days),'externalChartRunners':data.get('externalChartRunners',0),'enabled':False,'promoted':False,'status':'insufficient_data'}
    calendar_days=(date.fromisoformat(days[-1])-date.fromisoformat(days[0])).days+1 if days else 0
    if calendar_days<180 or len(races)<600:
        reports.append(report);continue
    warmup=(date.fromisoformat(days[0])+timedelta(days=60)).isoformat()
    eligible=[d for d in days if d>=warmup];vstart=eligible[int(len(eligible)*.6)];tstart=eligible[int(len(eligible)*.8)]
    if os.environ.get('FIXED_SPLITS_DIR'):
        fixed=json.loads((Path(os.environ['FIXED_SPLITS_DIR'])/f"{data['country']}-report.json").read_text(encoding='utf-8'))
        vstart=fixed['validation']['from'];tstart=fixed['test']['from']
    train=[r for r in races if warmup<=r['date']<vstart];validation=[r for r in races if vstart<=r['date']<tstart];test=[r for r in races if r['date']>=tstart]
    if len(test)<100 or len(train)<300:
        reports.append(report);continue
    # Constant and absent inputs cannot be advertised as learned evidence.
    indexes=[i for i in range(len(data['featureNames'])) if len({f[i] for r in train for f in r['features']})>1]
    def pool(rows):
        x=[];y=[];g=[]
        for group,r in enumerate(rows):
            x.extend([[f[i] for i in indexes] for f in r['features']]);y.extend(r['labels']);g.extend([group]*len(r['labels']))
        return Pool(np.asarray(x,float),np.asarray(y,float),group_id=g,feature_names=[data['featureNames'][i] for i in indexes])
    def predictions(model,rows):
        flat=model.predict(pool(rows));result=[];offset=0
        for r in rows:
            n=len(r['labels']);result.append(flat[offset:offset+n]);offset+=n
        return result
    def metrics(rows,scores,temp):
        hits=[];top3=[];brier=[];loss=[]
        for r,s in zip(rows,scores):
            y=np.asarray(r['labels'],float);y/=y.sum();s=np.asarray(s)/temp;p=np.exp(s-s.max());p/=p.sum();order=np.argsort(-p,kind='stable')
            hits.append(int(y[order[0]]>0));top3.append(int(y[order[:3]].sum()>0));brier.append(float(((p-y)**2).sum()));loss.append(float(-np.dot(y,np.log(np.clip(p,1e-12,1)))))
        return {'races':len(rows),'topOne':round(np.mean(hits)*100,2),'winnerInTopThree':round(np.mean(top3)*100,2),'brier':round(np.mean(brier),5),'logLoss':round(np.mean(loss),5),'hits':hits}
    choices=[];all_indexes=indexes[:]
    variants=['all_features']+(['without_verified_pace'] if data['country']=='US' and os.environ.get('PACE_FEATURES')=='1' else [])
    for variant in variants:
        indexes=[i for i in all_indexes if variant=='all_features' or i<82]
        for depth in [4,6]:
            model=CatBoostRanker(iterations=500,depth=depth,learning_rate=.045,loss_function='YetiRank',random_seed=42,thread_count=4,verbose=False,allow_writing_files=False)
            model.fit(pool(train),eval_set=pool(validation),early_stopping_rounds=60)
            vs=predictions(model,validation);temp=float(min(np.geomspace(.15,8,50),key=lambda t:metrics(validation,vs,t)['logLoss']))
            choices.append((metrics(validation,vs,temp)['logLoss'],model,temp,depth,indexes[:],variant))
    _,model,temp,depth,indexes,variant=min(choices,key=lambda c:c[0]);scores=predictions(model,test);candidate=metrics(test,scores,temp)
    report['featureVariant']=variant
    report['validationChoices']=[{'variant':c[5],'depth':c[3],'logLoss':c[0]} for c in choices]
    baseline=metrics(test,[np.log(np.clip(np.asarray(r['baseline'])/100,1e-12,1)) for r in test],1)
    delta=np.asarray(candidate['hits'])-np.asarray(baseline['hits']);rng=np.random.default_rng(42);ci=np.quantile([np.mean(rng.choice(delta,len(delta),replace=True))*100 for _ in range(1500)],[.025,.975])
    test_days=sorted({r['date'] for r in test});blocks=[np.asarray([delta[i] for i,r in enumerate(test) if r['date']==day]) for day in test_days]
    day_ci=np.quantile([np.concatenate([blocks[i] for i in rng.integers(0,len(blocks),len(blocks))]).mean()*100 for _ in range(1500)],[.025,.975])
    clean=lambda m:{k:v for k,v in m.items() if k!='hits'}
    market=[int(r['labels'][int(np.argmin([o if o and o>0 else np.inf for o in r['odds']]))]) for r in test if any(o and o>0 for o in r['odds'])]
    report.update(status='experiment_complete' if len(test)>=300 else 'experiment_small_sample',featureNames=[data['featureNames'][i] for i in indexes],featureIndexes=indexes,temperature=temp,depth=depth,trees=model.tree_count_,trainedThrough=days[-1],train={'from':warmup,'through':train[-1]['date'],'races':len(train)},validation={'from':vstart,'through':validation[-1]['date'],'races':len(validation)},test={'from':tstart,'through':days[-1],'candidate':clean(candidate),'baseline':clean(baseline),'closingFavoriteRate':round(np.mean(market)*100,2) if market else None,'closingFavoriteRaces':len(market),'pairedBootstrap95VsBaseline':[round(float(n),2) for n in ci]},note='Retrospective TJK-listed meetings only; incomplete careers and result times. No idman/weather claim for absent or constant fields. Closing odds used only for benchmark, never features. Not deployed; prospective validation and external data enrichment required.')
    model.save_model(str(root/f"{data['country']}-test.json"),format='json')
    importance=model.get_feature_importance(type='PredictionValuesChange');report['featureImportance']=[{'name':data['featureNames'][i],'importance':round(float(v),3)} for i,v in zip(indexes,importance)]
    report['test']['dayBootstrap95VsBaseline']=[round(float(n),2) for n in day_ci]
    report['externalImportance']=round(sum(float(v) for i,v in zip(indexes,importance) if data['featureNames'][i].startswith('external')),3)
    if data['country']=='US':
        full_indexes=indexes[:];indexes=[i for i in indexes if not data['featureNames'][i].startswith('external')]
        control=CatBoostRanker(iterations=model.tree_count_,depth=depth,learning_rate=.045,loss_function='YetiRank',random_seed=42,thread_count=4,verbose=False,allow_writing_files=False)
        control.fit(pool(train));vs=predictions(control,validation);ct=float(min(np.geomspace(.15,8,50),key=lambda t:metrics(validation,vs,t)['logLoss']))
        report['withoutExternalCharts']=metrics(test,predictions(control,test),ct);report['withoutExternalCharts'].pop('hits');indexes=full_indexes
    report['enabled']=bool(len(test)>=300 and candidate['topOne']-baseline['topOne']>=2 and day_ci[0]>0 and candidate['brier']<baseline['brier'] and candidate['winnerInTopThree']>=baseline['winnerInTopThree'])
    report['deploymentStatus']='prospective_trial' if report['enabled'] else 'not_enabled'
    report['method']=f"local_catboost_country_{data['country']}_v1"
    if os.environ.get('PERFORMANCE_FEATURES')=='1':
        report['featurePipeline']='performance_v2' if os.environ.get('IDENTITY_VERSION')=='2' else 'performance_v1'
        report['identityVersion']=int(os.environ.get('IDENTITY_VERSION','1'))
        report['method']=f"local_catboost_performance_{data['country']}_v4" if report['identityVersion']==2 else f"local_catboost_performance_{data['country']}_v3"
        base_count=58 if data['country']=='TR' else 65
        full_indexes=indexes[:];indexes=[i for i in indexes if i<base_count]
        control=CatBoostRanker(iterations=model.tree_count_,depth=depth,learning_rate=.045,loss_function='YetiRank',random_seed=42,thread_count=4,verbose=False,allow_writing_files=False)
        control.fit(pool(train));vs=predictions(control,validation);ct=float(min(np.geomspace(.15,8,50),key=lambda t:metrics(validation,vs,t)['logLoss']))
        report['withoutPerformance']=clean(metrics(test,predictions(control,test),ct));indexes=full_indexes
        incumbent_root=Path('data') if data['country']=='TR' else Path(os.environ.get('FOREIGN_INCUMBENT_DIR','data/foreign-models'))
        incumbent_report=incumbent_root/('ranking-report.json' if data['country']=='TR' else f"{data['country']}-report.json")
        if incumbent_report.exists():
            previous=json.loads(incumbent_report.read_text(encoding='utf-8-sig'))
            previous_data=json.loads((Path(previous['trainingDataPath']) if previous.get('trainingDataPath') else Path('data/training-races.json') if data['country']=='TR' else incumbent_root/f"{data['country']}-training.json").read_text(encoding='utf-8'))
            lookup={(r['date'],r['city'],r['no']):r for r in previous_data['races']}
            prior_rows=[lookup[(r['date'],r['city'],r['no'])] for r in test]
            old_model=CatBoostRanker();old_model.load_model(str(Path(previous['testModelPath']) if previous.get('testModelPath') else incumbent_root/('ranking-environment-test.json' if data['country']=='TR' else f"{data['country']}-test.json")),format='json')
            original_indexes=indexes[:];indexes=previous.get('featureIndexes',list(range(len(previous_data['featureNames']))))
            previous_scores=predictions(old_model,prior_rows);indexes=original_indexes
            previous_metrics=metrics(test,previous_scores,previous['temperature'])
            diff=np.asarray(candidate['hits'])-np.asarray(previous_metrics['hits'])
            blocks=[np.asarray([diff[i] for i,r in enumerate(test) if r['date']==day]) for day in test_days]
            incumbent_ci=np.quantile([np.concatenate([blocks[i] for i in rng.integers(0,len(blocks),len(blocks))]).mean()*100 for _ in range(1500)],[.025,.975])
            report['incumbent']={'metrics':clean(previous_metrics),'dayBootstrap95':[round(float(v),2) for v in incumbent_ci],'improvementPoints':round(candidate['topOne']-previous_metrics['topOne'],2)}
            report['test'].update(improvementPoints=round(candidate['topOne']-baseline['topOne'],2),improvementVsPrevious=report['incumbent']['improvementPoints'],previous=clean(previous_metrics),pairedBootstrap95VsPrevious=report['incumbent']['dayBootstrap95'])
            report['enabled']=bool(report['enabled'] and candidate['topOne']-previous_metrics['topOne']>=2 and incumbent_ci[0]>0 and candidate['brier']<previous_metrics['brier'] and candidate['winnerInTopThree']>=previous_metrics['winnerInTopThree'])
            report['deploymentStatus']='prospective_trial' if report['enabled'] else 'held_no_verified_incumbent_improvement'
    report['inputs']=['horse_history','jockey','trainer','rivals']+(['external_previous_charts'] if report['externalImportance']>0 else [])
    if os.environ.get('PERFORMANCE_FEATURES')=='1':
        report['inputs']+=['normalized_past_speed','past_class_comparison','recent_connections','pedigree_surface']
        if data['country']=='TR':report['inputs']+=['workouts','official_weather','official_going']
        if os.environ.get('IDENTITY_VERSION')=='2':report['inputs']+=['equipment_name_matching','apprentice_name_matching']
        if os.environ.get('PACE_FEATURES')=='1' and data['country']=='US' and any(i>=82 for i in indexes):report['inputs']+=['verified_past_call_positions','field_pace_competition']
    report['note']='First chronological country experiment. Prior official external result charts used only on later dates; no target-result information, workouts, or pre-race weather assumed. Closing favorite remains a benchmark, not an input. Prospective trial is enabled only with >=300 test races, >=2 points top-one improvement, positive day-bootstrap lower bound, and lower Brier.'
    (root/f"{data['country']}-reference.json").write_text(json.dumps({'features':test[0]['features'],'scores':scores[0].tolist()}),encoding='utf-8')
    if report['enabled'] or (os.environ.get('PERFORMANCE_FEATURES')=='1' and (data['country']=='TR' or os.environ.get('IDENTITY_VERSION')=='2')):
        live=CatBoostRanker(iterations=model.tree_count_,depth=depth,learning_rate=.045,loss_function='YetiRank',random_seed=42,thread_count=4,verbose=False,allow_writing_files=False)
        live.fit(pool([r for r in races if r['date']>=warmup]));live.save_model(str(root/f"{data['country']}-live.json"),format='json')
        report['liveTrainingRaces']=sum(r['date']>=warmup for r in races)
        if not report['enabled']:report['shadowEnabled']=True
    (root/f"{data['country']}-report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');reports.append(report)
    print(json.dumps({'country':data['country'],'test':report['test']}),flush=True)
if os.environ.get('TRAIN_COUNTRIES') and (root/'training-report.json').exists():
    previous_summary=json.loads((root/'training-report.json').read_text(encoding='utf-8'))
    reports+= [r for r in previous_summary['countries'] if r['country'] not in {new['country'] for new in reports}]
(root/'training-report.json').write_text(json.dumps({'countries':reports},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps([{'country':r['country'],'status':r['status'],'races':r['archiveRaces']} for r in reports]),flush=True)
