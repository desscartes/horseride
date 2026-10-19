"""Versioned overseas data experiment; chronological validation, no automatic promotion."""
import json, sys, hashlib, os
from pathlib import Path
from datetime import date, timedelta
from chronological_split import evaluation_cutoff
from validation_selection import choose_validation_index
from frozen_workout_plan import frozen_workout_plan
import numpy as np
from catboost import CatBoostRanker, Pool

root=Path(sys.argv[1]); countries=sys.argv[2].split(',')
def read(path): return json.loads(Path(path).read_text(encoding='utf-8-sig'))
def write(path,data): Path(path).write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
def shift(day,offset): return (date.fromisoformat(day)+timedelta(days=offset)).isoformat()
reports=[]
for artifact in countries:
    country=artifact.split('-')[0]; breed=artifact[len(country)+1:] if '-' in artifact else None
    folder=root/artifact;folder.mkdir(parents=True,exist_ok=True);data=read(root/country/f'{country}-training.json')
    rows=sorted([r for r in data['races'] if len(r['labels'])>=2 and sum(r['labels'])>0 and np.isfinite(r['features']).all()],key=lambda r:(r['date'],r['city'],r['no']))
    if breed:rows=[r for r in rows if r.get('breed')==breed]
    days=sorted({r['date'] for r in rows})
    if len(rows)<600 or not days or (date.fromisoformat(days[-1])-date.fromisoformat(days[0])).days<180:
        report={'country':country,'status':'insufficient_data','archiveRaces':len(rows),'archiveDays':len(days),'enabled':False,'shadowEnabled':False}
        write(folder/'report.json',report);reports.append(report);continue
    previous=read(root/f'incumbent-{country}.json') if (root/f'incumbent-{country}.json').exists() else None
    through=days[-1]; cutoff=evaluation_cutoff(through,previous['trainedThrough'] if previous else None); validation_from=shift(cutoff,-29)
    warmup=previous['train']['from'] if previous else shift(days[0],60)
    train=[r for r in rows if warmup<=r['date']<validation_from]
    validation=[r for r in rows if validation_from<=r['date']<=cutoff]
    test=[r for r in rows if r['date']>max(cutoff,previous['trainedThrough'] if previous else cutoff)]
    if len(train)<300 or len(validation)<20 or len(test)<20:
        report={'country':country,'status':'insufficient_chronological_test','enabled':False,'shadowEnabled':False,'trainRaces':len(train),'validationRaces':len(validation),'testRaces':len(test)}
        write(folder/'report.json',report);reports.append(report);continue
    names=data['featureNames']; varying=[i for i in range(len(names)) if len({f[i] for r in train for f in r['features']})>1]
    trees=previous['trees'] if previous else 300; depth=previous['depth'] if previous else 4
    def pool(races,indexes):
        x=[];y=[];groups=[]
        for g,r in enumerate(races):
            x.extend([[f[i] for i in indexes] for f in r['features']]);y.extend(r['labels']);groups.extend([g]*len(r['labels']))
        return Pool(np.asarray(x,float),np.asarray(y,float),group_id=groups)
    selected_parameters={'iterations':trees,'depth':depth,'learning_rate':.045,'l2_leaf_reg':3}
    def fit(races,indexes,parameters=None):
        model=CatBoostRanker(**(parameters or selected_parameters),loss_function='YetiRank',random_seed=42,thread_count=2,verbose=False,allow_writing_files=False)
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
    workout_start=names.index('equibaseTimedCount') if 'equibaseTimedCount' in names else len(names)
    family_start=names.index('missingSire')
    variants=[('class_and_family',varying),('class_without_family',[i for i in varying if i<family_start or i>=workout_start or names[i].startswith('au')])]
    maiden_money_names={'observedMaidenStarts','observedMaidenSeconds','observedMaidenTopThree','observedCareerWins','maidenLastThreeImproving','maidenNoObservedHistory','raceWinnerPrizeLog','missingRaceWinnerPrize','priorSameCurrencyPrizeRatio','missingPriorPrizeComparison'}
    without_maiden_money=[i for i in varying if names[i] not in maiden_money_names]
    if without_maiden_money!=varying:
        variants.append(('without_maiden_prize',without_maiden_money))
    if country=='US': variants.append(('class_without_pace',[i for i in varying if not 82<=i<91]))
    if country=='AU': variants.append(('without_australian_form',[i for i in varying if not names[i].startswith('au')]))
    choices=[];validation_metrics=[]
    parameter_grid=[dict(selected_parameters)]
    if os.environ.get('HORSERIDE_MODEL_SEARCH')=='1':
        parameter_grid.extend([
            {'iterations':450,'depth':4,'learning_rate':.035,'l2_leaf_reg':8},
            {'iterations':350,'depth':5,'learning_rate':.035,'l2_leaf_reg':12},
            {'iterations':600,'depth':3,'learning_rate':.035,'l2_leaf_reg':8},
        ])
    # Freeze every choice using only the earlier validation month. The test
    # window is scored once after selection and never participates in tuning.
    frozen_parent=read(os.environ['HORSERIDE_FROZEN_PARENT_REPORT']) if os.environ.get('HORSERIDE_FROZEN_PARENT_REPORT') else None
    for variant,indexes in ([] if frozen_parent else variants):
        for parameters in parameter_grid:
            model=fit(train,indexes,parameters);scores=predict(model,validation,indexes)
            temperature=float(min(np.geomspace(.15,8,40),key=lambda t:metrics(validation,scores,t)[0]['logLoss']))
            measured=metrics(validation,scores,temperature)[0];validation_metrics.append(measured)
            score=measured['logLoss'];choices.append((score,variant,indexes,temperature,dict(parameters)))
            print(json.dumps({'country':artifact,'phase':'validation_search','variant':variant,'parameters':parameters,'validationLogLoss':score}),flush=True)
    objective=os.environ.get('HORSERIDE_SEARCH_OBJECTIVE','log_loss')
    if frozen_parent:
        objective='frozen_parent'
        plan=frozen_workout_plan(frozen_parent,names,[r for r in rows if warmup<=r['date']<=cutoff],cutoff,country)
        variant='parent_plus_workout_speed';indexes=plan['indexes'];temperature=plan['temperature'];selected_parameters=plan['parameters']
    else:
        _,variant,indexes,temperature,selected_parameters=choices[choose_validation_index(validation_metrics,objective)]
    trees=selected_parameters['iterations'];depth=selected_parameters['depth']
    fit_rows=[r for r in rows if warmup<=r['date']<=cutoff]
    test_model=fit(fit_rows,indexes);candidate,candidate_hits=metrics(test,predict(test_model,test,indexes),temperature)
    if previous:
        control=read(root/'control'/country/f'{country}-training.json');lookup={(r['date'],r['city'],r['no']):r for r in control['races']}
        prior_rows=[]
        for r in test:
            old=lookup[(r['date'],r['city'],r['no'])]
            if r['horses']!=old['horses'] or r['labels']!=old['labels']: raise ValueError('Incumbent field/label alignment failed')
            prior_rows.append(old)
        old_model=CatBoostRanker();old_model.load_model(previous['modelPath'],format='json')
        incumbent,incumbent_hits=metrics(prior_rows,predict(old_model,prior_rows,previous['featureIndexes']),previous['temperature'])
        comparator='active_country_model_with_its_own_feature_pipeline'
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
    report={'country':country,'status':'intelligence_candidate','method':f'local_catboost_intelligence_{country}_v1_{through.replace("-","")}','featurePipeline':'intelligence_v1','identityVersion':data.get('identityVersion',1),'featureIndexes':indexes,'featureNames':[names[i] for i in indexes],'temperature':temperature,'depth':depth,'trees':trees,'trainedThrough':through,'archiveRaces':len(rows),'archiveDays':len(days),'liveTrainingRaces':len(live_rows),'train':{'from':warmup,'through':cutoff,'races':len(fit_rows)},'validation':{'from':validation_from,'through':cutoff,'races':len(validation)},'featureVariant':variant,'validationChoices':[{'variant':v,'logLoss':s} for s,v,_,_,_ in choices],'evaluation':evaluation,'enabled':False,'promoted':False,'shadowEnabled':True,'externalChartsPath':str(root/'charts.json').replace('\\','/'),'trainingDataPath':str(folder/f'{country}-training.json').replace('\\','/'),'inputs':['horse_history','workouts','past_speed_class','normalized_race_class','class_transition','pedigree','gate_history'],'note':'Country-specific chronological class and family experiment. No market or target result input; no automatic activation.'}
    report['trainingDataPath']=str(root/country/f'{country}-training.json').replace('\\','/')
    report['evaluationRole']='retrospective_reused_holdout_requires_prospective'
    report['winnerOnlyTargetRaces']=sum(bool(r.get('winnerOnly')) for r in rows)
    report['historyPolicy']='complete_results_only_winner_only_targets_never_update_history'
    report['prospectiveRequired']=True
    report['intelligenceSchemaVersion']=2 if 'observedMaidenStarts' in names else 1
    report['validationChoices']=[{'variant':v,'logLoss':s,'parameters':p} for s,v,_,_,p in choices]
    if workout_start<len(names):
        report['featurePipeline']='intelligence_workout_v1'
        report['inputs'].append('official_equibase_workout_speed')
        timed_index=names.index('equibaseTimedCount')
        report['workoutSpeedEvidence']={'trainingRunners':sum(len(r['features']) for r in fit_rows),'trainingWithTimedWorkouts':sum(f[timed_index]>0 for r in fit_rows for f in r['features']),'parameterSelectionTrainingWithTimedWorkouts':sum(f[timed_index]>0 for r in train for f in r['features']),'validationWithTimedWorkouts':sum(f[timed_index]>0 for r in validation for f in r['features']),'selectedFeatureNames':[names[i] for i in indexes if i>=workout_start]}
        report['workoutSpeedInputsSelected']=any(i>=workout_start for i in indexes)
        if not report['workoutSpeedEvidence']['trainingWithTimedWorkouts']:report['experimentWarning']='no_training_examples_for_workout_speed'
    report['trainingParameters']=selected_parameters
    report['searchSelection']='earlier_validation_top_one_then_brier' if objective=='top_one' else 'earlier_validation_log_loss_only'
    if frozen_parent:
        report['searchSelection']='frozen_parent_earlier_validation_parameters';report['parentStudyMethod']=plan['parentMethod']
    report['validationMetrics']=validation_metrics
    # Choose a selective prediction gate ONLY on the earlier validation set.
    gate_model=fit(train,indexes);validation_scores=predict(gate_model,validation,indexes)
    def probabilities(scores):
        values=[]
        for s in scores:
            s=np.asarray(s)/temperature;p=np.exp(s-s.max());p/=p.sum();order=np.argsort(-p,kind='stable');values.append((p,order))
        return values
    vp=probabilities(validation_scores);gates=[]
    for threshold in [.35,.4,.45,.5,.55,.6,.65]:
        for gap in [.05,.1,.15,.2]:
            chosen=[i for i,(p,o) in enumerate(vp) if p[o[0]]>=threshold and p[o[0]]-p[o[1]]>=gap]
            if len(chosen)<30:continue
            hits=sum(validation[i]['labels'][vp[i][1][0]]>0 for i in chosen);n=len(chosen);rate=hits/n;z=1.96
            lower=(rate+z*z/(2*n)-z*np.sqrt(rate*(1-rate)/n+z*z/(4*n*n)))/(1+z*z/n)
            gates.append({'threshold':threshold,'minimumGap':gap,'validationRaces':n,'validationHitRate':round(100*rate,2),'validationCoverage':round(100*n/len(validation),2),'validationWilsonLower95':round(100*lower,2)})
    eligible=[g for g in gates if g['validationWilsonLower95']>50]
    gate=max(eligible,key=lambda g:g['validationRaces']) if eligible else None
    report['selectiveGate']={'status':'validation_supported_shadow' if gate else 'not_enough_evidence_above_50','rule':gate,'automaticRecommendation':False}
    if gate:
        tp=probabilities(predict(test_model,test,indexes));chosen=[i for i,(p,o) in enumerate(tp) if p[o[0]]>=gate['threshold'] and p[o[0]]-p[o[1]]>=gate['minimumGap']]
        report['selectiveGate']['test']={'races':len(chosen),'coveragePercent':round(100*len(chosen)/len(test),2),'topOne':round(100*sum(test[i]['labels'][tp[i][1][0]]>0 for i in chosen)/len(chosen),2) if chosen else None}
    report['segments']={}
    for label in sorted({r.get('breed','all') for r in test}):
        segment=[r for r in test if r.get('breed','all')==label]
        report['segments'][label]=metrics(segment,predict(test_model,segment,indexes),temperature)[0]
    report['dataCoverage']={name:{'nonzeroRunners':sum(f[i]!=0 for r in rows for f in r['features']),'variedInTraining':i in varying} for i,name in enumerate(names) if name in ['missingWorkout','missingWeather','missingSire','missingDam','missingDamsire','classKnown','sameNormalizedClassStarts','speedEvidenceCount','wetHistoryStarts','gateCohortStarts']}
    report['artifactKey']=artifact;report['breed']=breed;report['pipelineRevision']=2
    if data.get('australianSchemaVersion'): report['australianSchemaVersion']=data['australianSchemaVersion']
    monetary_names=['observedMaidenStarts','observedMaidenSeconds','maidenLastThreeImproving','raceWinnerPrizeLog','missingRaceWinnerPrize','priorSameCurrencyPrizeRatio','missingPriorPrizeComparison']
    if country=='AU' and 'auProfileMissing' in names:
        profile_index=names.index('auProfileMissing')
        report['australianCoverage']={split_name:{'runners':sum(len(r['features']) for r in split_rows),'matchedProfiles':sum(f[profile_index]==0 for r in split_rows for f in r['features'])} for split_name,split_rows in [('train',train),('validation',validation),('test',test)]}
    report['maidenPrizeCoverage']={}
    for split_name,split_rows in [('train',train),('validation',validation),('test',test)]:
        runners=sum(len(r['features']) for r in split_rows)
        report['maidenPrizeCoverage'][split_name]={'runners':runners,'features':{name:{'nonzeroRunners':sum(f[names.index(name)]!=0 for r in split_rows for f in r['features'])} for name in monetary_names if name in names}}
    report['method']=report['method'].replace('_v1_','_v2_')
    if breed:report['method']+=f'_{breed}'
    fingerprint=hashlib.sha256((root/country/f'{country}-training.json').read_bytes()).hexdigest()[:12]
    report['trainingFingerprint']=fingerprint;report['method']+=f'_{fingerprint}'
    if os.environ.get('HORSERIDE_MODEL_SEARCH')=='1':
        signature=hashlib.sha256(json.dumps({'parameters':selected_parameters,'variant':variant,'featureIndexes':indexes,'evaluationCutoff':cutoff,'temperature':temperature,'objective':objective,'parentMethod':frozen_parent['method'] if frozen_parent else None},sort_keys=True).encode()).hexdigest()[:10]
        report['pipelineRevision']=3;report['method']=report['method'].replace('_v2_','_v3_')+f'_search_{signature}'
    if workout_start<len(names):
        report['pipelineRevision']=4;report['method']=report['method'].replace('_v3_','_v4_').replace('_v2_','_v4_')
    importance=live.get_feature_importance(type='PredictionValuesChange');report['featureImportance']=[{'name':names[i],'importance':round(float(v),4)} for i,v in zip(indexes,importance)]
    if workout_start<len(names):
        contributing=[names[i] for i,v in zip(indexes,importance) if i>=workout_start and v>0]
        report['workoutSpeedEvidence']['contributingFeatureNames']=contributing
        report['workoutSpeedUsed']=bool(contributing)
    write(folder/'report.json',report);reports.append(report)
    print(json.dumps({'country':country,'variant':variant,'evaluation':evaluation}),flush=True)
write(root/'training-report.json',{'countries':reports})
