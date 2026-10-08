"""Daily candidate with fixed incumbent parameters and chronological evaluation."""
import json, sys, os
from pathlib import Path
from datetime import date, timedelta
sys.path.insert(0, str(Path('.tools/ml-python').resolve()))
import numpy as np
from catboost import CatBoostRanker, Pool

country, output_path, incumbent_path = sys.argv[1:4]
root = Path(output_path)
previous = json.loads(Path(incumbent_path).read_text(encoding='utf-8'))
data = json.loads((root / f'{country}-training.json').read_text(encoding='utf-8'))
indexes = previous['featureIndexes']
rows = [r for r in data['races'] if len(r['features']) >= 2 and sum(r['labels']) > 0
        and np.isfinite(np.asarray(r['features'], dtype=float)).all()]
rows.sort(key=lambda r: (r['date'], r['city'], r['no']))
warmup = previous['train']['from']
rows = [r for r in rows if r['date'] >= warmup]
if len(rows) < 600:
    raise ValueError('Insufficient completed races for daily training')
through = max(r['date'] for r in rows)
cutoff = (date.fromisoformat(through) - timedelta(days=30)).isoformat()
fit_rows = [r for r in rows if r['date'] <= cutoff]
test_rows = [r for r in rows if r['date'] > cutoff and r['date'] > previous['trainedThrough']]
if len(fit_rows) < 300:
    raise ValueError('Insufficient chronological training rows')

def pool(races):
    x, y, groups = [], [], []
    for group, race in enumerate(races):
        x.extend([[f[i] for i in indexes] for f in race['features']])
        y.extend(race['labels'])
        groups.extend([group] * len(race['labels']))
    return Pool(x, y, group_id=groups)

def fit(races):
    model = CatBoostRanker(iterations=previous['trees'], depth=previous['depth'], learning_rate=.045,
                          loss_function='YetiRank', random_seed=42, thread_count=2,
                          verbose=False, allow_writing_files=False)
    model.fit(pool(races))
    return model

def predict(model, races):
    values = model.predict(pool(races))
    scores, offset = [], 0
    for race in races:
        count = len(race['labels'])
        scores.append(np.asarray(values[offset:offset+count]))
        offset += count
    return scores

def metrics(races, scores):
    hits, top_three, briers = [], [], []
    for race, score in zip(races, scores):
        y = np.asarray(race['labels'], dtype=float); y /= y.sum()
        s = score / previous['temperature']; p = np.exp(s-s.max()); p /= p.sum()
        order = np.argsort(-p, kind='stable')
        hits.append(int(y[order[0]] > 0))
        top_three.append(int(y[order[:3]].sum() > 0))
        briers.append(float(((p-y)**2).sum()))
    return {'topOne': round(float(np.mean(hits)*100), 2),
            'winnerInTopThree': round(float(np.mean(top_three)*100), 2),
            'brier': round(float(np.mean(briers)), 6)}, np.asarray(hits)

evaluation = None
if test_rows:
    test_model = fit(fit_rows)
    incumbent_model = CatBoostRanker()
    active_pointer = Path(f'data/daily-models/active-{country}.json')
    incumbent_model_path = json.loads(active_pointer.read_text())['modelPath'] if active_pointer.exists() else (
        'data/ranking-live.json' if country == 'TR' else 'data/foreign-models/US-live.json')
    incumbent_model.load_model(str(incumbent_model_path), format='json')
    candidate_metrics, candidate_hits = metrics(test_rows, predict(test_model, test_rows))
    incumbent_metrics, incumbent_hits = metrics(test_rows, predict(incumbent_model, test_rows))
    days = sorted({r['date'] for r in test_rows})
    delta = candidate_hits - incumbent_hits
    blocks = [delta[[i for i,r in enumerate(test_rows) if r['date'] == day]] for day in days]
    rng = np.random.default_rng(42)
    bootstrap = [np.concatenate([blocks[i] for i in rng.integers(0,len(blocks),len(blocks))]).mean()*100 for _ in range(1000)]
    bounds = np.quantile(bootstrap, [.025,.975])
    evaluation = {'races': len(test_rows), 'days': len(days), 'testFrom': min(days), 'testThrough': max(days),
                  'candidateTrainedThrough': cutoff, 'incumbentTrainedThrough': previous['trainedThrough'],
                  'candidate': candidate_metrics, 'incumbent': incumbent_metrics,
                  'improvementPoints': round(candidate_metrics['topOne']-incumbent_metrics['topOne'],2),
                  'dayBootstrap95': [round(float(n),3) for n in bounds]}

live = fit(rows)
live.save_model(str(root/'live.json'), format='json')
sample = rows[-1]
reference_scores = predict(live, [sample])[0]
(root/'reference.json').write_text(json.dumps({'features':sample['features'],'scores':reference_scores.tolist()}), encoding='utf-8')
report = {**previous, 'country': country, 'method': previous['method'].split('_daily_')[0]+'_daily_'+through.replace('-',''),
          'trainedThrough': through, 'liveTrainingRaces': len(rows), 'evaluation': evaluation,
          'enabled': False, 'promoted': False, 'shadowEnabled': True, 'status':'daily_candidate',
          'dailyTraining': {'through': through, 'threadCount':2, 'newRaceResults':sum(r['date']>previous['trainedThrough'] for r in rows)},
          'note':'Fixed incumbent features and parameters. Trained daily on completed earlier races; live model stays unchanged unless the separate chronological evaluation gate passes. No guaranteed accuracy gain.'}
report.pop('test', None)  # Never copy old success percentages onto a newly trained candidate.
(root/'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'country':country,'trainedThrough':through,'races':len(rows),'evaluation':evaluation}), flush=True)
