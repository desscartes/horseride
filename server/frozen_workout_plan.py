"""A predeclared workout ablation: reuse earlier-selected parameters, no new search."""
import math

def frozen_workout_plan(parent,names,fit_rows,cutoff,country):
    if country!='US' or parent.get('country')!='US' or parent.get('featurePipeline')!='intelligence_v1':
        raise ValueError('A no-workout-speed US parent is required')
    if parent.get('searchSelection') not in ('earlier_validation_log_loss_only','earlier_validation_top_one_then_brier'):
        raise ValueError('Parent parameters must come from earlier validation')
    if parent['evaluation']['candidateTrainedThrough']!=cutoff:
        raise ValueError('Parent and candidate learning cutoffs differ')
    start=names.index('equibaseTimedCount');base=parent['featureIndexes']
    if not base or any(i<0 or i>=start for i in base) or [names[i] for i in base]!=parent['featureNames']:
        raise ValueError('Parent feature schema mismatch')
    if not fit_rows or any(row['date']>cutoff for row in fit_rows):
        raise ValueError('Only pre-test fit rows may define the extra inputs')
    if not any(f[start]>0 for row in fit_rows for f in row['features']):
        raise ValueError('No official timed workouts available before test')
    extras=[i for i in range(start,len(names)) if len({f[i] for row in fit_rows for f in row['features']})>1]
    if not extras:raise ValueError('No varying workout inputs in the fit window')
    temperature=parent['temperature']
    if not isinstance(temperature,(int,float)) or not math.isfinite(temperature) or temperature<=0:
        raise ValueError('Invalid frozen temperature')
    return {'indexes':list(base)+extras,'parameters':dict(parent['trainingParameters']),'temperature':temperature,'parentMethod':parent['method']}
