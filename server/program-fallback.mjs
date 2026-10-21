export function fallbackProgram(program,date,city){
 if(program?.date!==date||!Array.isArray(program.races)||!program.races.length)return null
 const all=['Tümü','Tüm program','Hepsi','all'].includes(city),races=all?program.races:program.races.filter(r=>r.city===city)
 if(!races.length)return null
 return {date,city,races,meetings:(program.meetings||[]).filter(m=>all||m.city===city||m.name===city),fetchedAt:program.fetchedAt,model:program.model,modelTrainedThrough:program.modelTrainedThrough,source:'last_published_program',cachedProgram:true,stale:true,warnings:['Canlı sunucu geçici olarak erişilemiyor; seçilen tarihin son yayımlanan programı gösteriliyor.']}
}
