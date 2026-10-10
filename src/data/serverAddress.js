export const serverAddressKey='ganyan-server-address-v1'
export function normalizeServerAddress(value){
  const url=new URL(String(value).trim())
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('HTTP veya HTTPS sunucu adresi girin.')
  if(url.pathname!=='/'&&url.pathname!=='/api/races')throw Error('Yalnızca sunucu adresini girin; örnek: http://192.168.1.21:8788')
  url.pathname='/api/races';url.search='';url.hash='';return url.href
}
