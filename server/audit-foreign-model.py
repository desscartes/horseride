"""Describe chronological test failures; these slices are diagnostics, not tuning targets."""
import json, os, sys
from pathlib import Path
sys.path.insert(0, str(Path('.tools/ml-python').resolve()))
import numpy as np
from catboost import CatBoostRanker

root = Path(os.environ.get('FOREIGN_MODEL_DIR', 'data/foreign-models'))
reports = []
for path in sorted(root.glob('*-report.json')):
    report = json.loads(path.read_text(encoding='utf-8-sig'))
    if 'test' not in report: continue
    country = report['country']
    data = json.loads((root/f'{country}-training.json').read_text(encoding='utf-8'))
    races = [r for r in data['races'] if r['date'] >= report['test']['from']]
    model = CatBoostRanker(); model.load_model(str(root/f'{country}-test.json'), format='json')
    indexes = report['featureIndexes']
    scores = model.predict(np.asarray([[f[i] for i in indexes] for r in races for f in r['features']], float))
    offset = 0; rows = []; groups = {}
    for r in races:
        n = len(r['labels']); s = scores[offset:offset+n]; offset += n
        order = np.argsort(-s, kind='stable'); winner = np.flatnonzero(r['labels'])
        hit = bool(r['labels'][order[0]]); top3 = bool(sum(r['labels'][i] for i in order[:3]))
        past = data['featureNames'].index('pastStarts') if 'pastStarts' in data['featureNames'] else 13
        row = {'date':r['date'], 'city':r['city'], 'no':r['no'], 'hit':int(hit), 'top3':int(top3), 'selected':r['horses'][order[0]], 'winners':[r['horses'][i] for i in winner]}
        rows.append(row)
        distance=r['features'][0][1]
        tags=[f"track:{r['city']}", 'surface:turf' if r['features'][0][2] else 'surface:synthetic' if r['features'][0][3] else 'surface:dirt', f"field:{'<=7' if n<=7 else '8-10' if n<=10 else '11+'}", f"distance:{'<=1200' if distance<=1200 else '1201-1800' if distance<=1800 else '1801+'}", 'race:maiden' if r['features'][0][5] else 'race:other', 'leader:no_archived_history' if r['features'][order[0]][past]==0 else 'leader:archived_history']
        for tag in tags: groups.setdefault(tag, []).append(row)
    slices=[{'group':tag, 'races':len(values), 'topOne':round(np.mean([v['hit'] for v in values])*100,2), 'winnerInTopThree':round(np.mean([v['top3'] for v in values])*100,2), 'smallSample':len(values)<100} for tag,values in groups.items()]
    out={'country':country, 'from':races[0]['date'], 'through':races[-1]['date'], 'races':len(rows), 'slices':sorted(slices,key=lambda s:s['group']), 'predictions':rows, 'note':'Retrospective diagnostic slices; small groups are unreliable. Test set has been inspected and is no longer an untouched development holdout. Further improvements require fresh prospective races.'}
    (root/f'{country}-diagnostic.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
    reports.append({k:v for k,v in out.items() if k!='predictions'})
(root/'diagnostic-report.json').write_text(json.dumps({'countries':reports},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps([{'country':r['country'],'races':r['races'],'slices':len(r['slices'])} for r in reports]),flush=True)
