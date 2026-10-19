"""Keep race events as source text. Never label a penalised rider's horse a victim."""
import json,re,sys,unicodedata
from pathlib import Path
import pdfplumber
from concurrent.futures import ProcessPoolExecutor
def parse(path):
    source=json.loads(path.with_suffix('.source.json').read_text(encoding='utf-8'))
    with pdfplumber.open(path) as pdf:text='\n'.join(p.extract_text() or '' for p in pdf.pages)
    date=source['date'];y,m,d=date.split('-')
    if not re.search(rf'{d}[/.]{m}[/.]{y}',text):return {'source':source,'events':[],'rejected':'header_date_mismatch'}
    norm=lambda s:re.sub('[^A-Z0-9]','',unicodedata.normalize('NFKD',s).upper().replace('İ','I'))
    if norm(source['city']) not in norm(text[:400]):return {'source':source,'events':[],'rejected':'header_meeting_mismatch'}
    events=[]
    for section in re.finditer(r'KO[ŞS]U\s+NO\s*:\s*(\d+)\s*([\s\S]*?)(?=KO[ŞS]U\s+NO\s*:|$)',text,re.I):
        for match in re.finditer(r'Koşuda\s+(\d+)\s+numarada\s+kayıtlı\s+(.+?)\s+isimli\s+at[ıi]n?\b([\s\S]*?)(?=\nKoşuda|$)',section[2],re.I):
            statement=re.sub(r'\s+',' ',match[0]).strip()
            events.append({'date':date,'city':source['city'],'raceNo':int(section[1]),'horseNo':int(match[1]),'horseName':re.sub(r'\s+',' ',match[2]).strip(),'text':statement[:1800],'sourceUrl':source['sourceUrl'],'availability':'post_race_report','classification':'official_race_event_not_assumed_victim'})
    return {'source':source,'events':events}
if __name__=='__main__':
    root=Path('data/external/stewards');paths=[p for p in root.glob('*.pdf') if p.with_suffix('.source.json').exists()]
    rows=[]
    with ProcessPoolExecutor(max_workers=3) as pool:
        for i,row in enumerate(pool.map(parse,paths),1):
            rows.append(row)
            if i%100==0:print(json.dumps({'parsed':i,'total':len(paths)}),flush=True)
    events=[event for row in rows for event in row['events']]
    report={'documents':len(rows),'events':len(events),'rejectedDates':sum('rejected' in r for r in rows)}
    (root/'parsed.json').write_text(json.dumps({'report':report,'events':events},ensure_ascii=False),encoding='utf-8')
    print(json.dumps(report),flush=True)
