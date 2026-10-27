export function raceSegment(race){
 const type=String(race?.type||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replaceAll('ı','i')
 if(/maiden|sartli\s*1|condition\s*1/.test(type))return 'maiden_or_debut_eligible'
 if(/handikap|handicap/.test(type))return 'handicap'
 if(/grup|group|graded|listed|stakes/.test(type))return 'stakes'
 return type.trim()?'other':'unknown'
}
