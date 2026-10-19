"""Extract only explicitly printed, source-dated winner pedigrees from free charts."""
import json,re,hashlib,sys
from pathlib import Path
from datetime import datetime
from concurrent.futures import ProcessPoolExecutor
import pdfplumber
try:
    from pypdf import PdfReader
except ImportError:
    PdfReader=None

def parse_pedigree(text):
    match=re.search(r'Winner:\s*(.+?),[^\n]*?\bby\s*(.+?)\s*out\s*of\s*(.+?),\s*by\s*(.+?)\.\s*Foaled',text)
    if not match:return None
    name,sire,dam,damsire=(v.strip() for v in match.groups())
    if not all(v and len(v)<100 for v in [name,sire,dam,damsire]):return None
    return dict(name=name,sire=sire,dam=dam,damsire=damsire)

def extract(path):
    metadata=json.loads(path.with_suffix('.source.json').read_text(encoding='utf-8-sig'))
    checksum=hashlib.sha256(path.read_bytes()).hexdigest();cached=path.with_suffix('.pedigree.json')
    if cached.exists():
        saved=json.loads(cached.read_text(encoding='utf-8'))
        if saved.get('checksum')==checksum:return saved['rows']
    rows=[]
    with path.open('rb') as source:
        pdf=PdfReader(source) if PdfReader else pdfplumber.open(source)
        for page in pdf.pages:
            text=(page.extract_text() if PdfReader else page.extract_text(x_tolerance=1)) or ''
            header=re.search(r'^(.+?) - ([A-Za-z]+ \d+, \d{4}) - Race (\d+)',text)
            pedigree=parse_pedigree(text)
            if not header or not pedigree:continue
            date=datetime.strptime(header[2],'%B %d, %Y').date().isoformat()
            if date!=metadata['date']:raise ValueError('Official date mismatch')
            rows.append(dict(**pedigree,date=date,track=header[1].replace(' ',''),raceNo=int(header[3]),sourceUrl=metadata['url'],availability='post_race_static_pedigree'))
    cached.write_text(json.dumps(dict(checksum=checksum,rows=rows),ensure_ascii=False),encoding='utf-8')
    return rows

if __name__=='__main__':
    paths=[]
    for folder in sys.argv[1:] or ['data/external/equibase','data/external/equibase-career']:
        paths.extend(p for p in sorted(Path(folder).glob('*.pdf')) if p.with_suffix('.source.json').exists())
    rows=[]
    with ProcessPoolExecutor(max_workers=2) as executor:
        for n,parsed in enumerate(executor.map(extract,paths),1):
            rows.extend(parsed)
            if n%50==0:print(json.dumps(dict(processed=n,total=len(paths),pedigrees=len(rows))),flush=True)
    output=Path('data/external/equibase-pedigree');output.mkdir(parents=True,exist_ok=True)
    (output/'records.json').write_text(json.dumps(dict(records=rows),ensure_ascii=False),encoding='utf-8')
    print(json.dumps(dict(charts=len(paths),pedigrees=len(rows))),flush=True)
