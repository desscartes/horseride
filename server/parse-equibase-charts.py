"""Read free official charts. Keep source fields; never estimate individual times."""
import json,re,sys,hashlib
from datetime import datetime
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
import pdfplumber

def parse(path):
    races=[]
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            text=page.extract_text(x_tolerance=1) or ''
            header=re.search(r'^(.+?) - ([A-Za-z]+ \d+, \d{4}) - Race (\d+)',text)
            if not header: continue
            words=page.extract_words(x_tolerance=1)
            pgm=next((w for w in words if w['text']=='Pgm' and w['top']<400),None)
            if not pgm: continue
            top=pgm['top'];heads=[w for w in words if abs(w['top']-top)<1]
            def x(name):return next((w['x0'] for w in heads if w['text']==name),None)
            keys=['Pgm','Horse','Wgt','PP','Start','Fin','Odds','Comments'];positions={k:x(k) for k in keys}
            if any(v is None for v in positions.values()):continue
            end=next((w['top'] for w in words if w['text']=='Fractional' and w['top']>top),None)
            if end is None:continue
            starters=[w for w in words if positions['Pgm']-1<=w['x0']<positions['Horse']-2 and top+7<w['top']<end and re.fullmatch(r'\d+[A-Z]?',w['text'])]
            runners=[]
            for starter in starters:
                y=starter['top'];near=[w for w in words if y-3<=w['top']<=y+3]
                def column(left,right):return ' '.join(w['text'] for w in near if left-1<=w['x0']<right-1)
                rawname=column(positions['Horse'],positions['Wgt']);name=re.sub(r'\s*\(.*','',rawname).strip()
                if not name:continue
                weight=column(positions['Wgt'],positions['PP']).split()[0]
                # Position digits use the row baseline; superscript lengths use
                # a different baseline and must never be read as positions.
                calls={}
                callheads=sorted([w for w in heads if positions['Start']<=w['x0']<=positions['Fin']],key=lambda w:w['x0'])
                for index,head in enumerate(callheads):
                    right=callheads[index+1]['x0'] if index+1<len(callheads) else positions['Odds']
                    chars=sorted([c for c in page.chars if head['x0']-1<=c['x0']<right-1 and abs(c['top']-y)<.75],key=lambda c:c['x0'])
                    raw=''.join(c['text'] for c in chars).strip()
                    if re.fullmatch(r'\d{1,2}',raw) and 1<=int(raw)<=len(starters):calls[head['text']]=int(raw)
                runners.append({'number':starter['text'],'name':name,'weightKg':round(float(weight)*.45359237,2) if weight.isdigit() else None,'gate':column(positions['PP'],positions['Start']),'runningPositionsRaw':column(positions['Start'],positions['Fin']),'finishRaw':column(positions['Fin'],positions['Odds']),'calls':calls,'comment':column(positions['Comments'],page.width)})
            weather=re.search(r'Weather:\s*(.+?),\s*(\d+).*?Track:\s*(.+)',text)
            fractions=re.search(r'Fractional Times:\s*(.*?)\s*Final Time:\s*([\d:.]+)',text)
            races.append({'track':header[1].replace(' ',''),'dateDisplay':header[2],'raceNo':int(header[3]),'runners':runners,'weatherText':weather[1] if weather else None,'temperatureC':round((int(weather[2])-32)*5/9,2) if weather else None,'going':weather[3].strip() if weather else None,'fractionalTimes':fractions[1].split() if fractions else [],'winnerTime':fractions[2] if fractions else None,'conditions':text.split('Last Raced')[0],'sourcePage':page.page_number,'availability':'post_race_chart'})
    return races

def parse_cached(path):
    metadata=json.loads(path.with_suffix('.source.json').read_text(encoding='utf-8'))
    checksum=hashlib.sha256(path.read_bytes()).hexdigest()
    cached=path.with_suffix('.parsed.json')
    if cached.exists():
        saved=json.loads(cached.read_text(encoding='utf-8'))
        if saved.get('checksum')==checksum and saved.get('version')==2: return saved['races']
    parsed=parse(path)
    for row in parsed:
        actual=datetime.strptime(row['dateDisplay'],'%B %d, %Y').date().isoformat()
        if actual!=metadata['date']: raise ValueError(f'{path.name}: official date mismatch')
        row.update(sourceUrl=metadata['url'],date=actual,retrievedAt=metadata['retrievedAt'])
    cached.write_text(json.dumps({'version':2,'checksum':checksum,'races':parsed},ensure_ascii=False),encoding='utf-8')
    return parsed

if __name__=='__main__':
    directory=Path(sys.argv[1]);rows=[]
    paths=[p for p in sorted(directory.glob('*.pdf')) if p.with_suffix('.source.json').exists()]
    with ProcessPoolExecutor(max_workers=3) as executor:
        for index,parsed in enumerate(executor.map(parse_cached, paths),1):
            rows.extend(parsed)
            if index%30==0:print(json.dumps({'processed':index,'total':len(paths),'races':len(rows)}),flush=True)
    out=directory/'parsed.json';out.write_text(json.dumps({'provider':'Equibase','races':rows},ensure_ascii=False),encoding='utf-8')
    print(json.dumps({'charts':len(list(directory.glob('*.pdf'))),'races':len(rows),'runners':sum(len(r['runners']) for r in rows)}))
