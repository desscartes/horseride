export function couponChanceText(chance){
 if(typeof chance!=='number'||!Number.isFinite(chance)||chance<0||chance>1)return 'Tutma tahmini hesaplanamadı'
 const percent=chance*100
 const label=percent>0&&percent<0.01?'%0,01’den az':`%${percent.toLocaleString('tr-TR',{maximumFractionDigits:2})}`
 return `Tahmini tutma: ${label} · Kalibre edilmemiş model hesabı`
}
