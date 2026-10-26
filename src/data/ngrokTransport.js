export function installNgrokTransport(scope=globalThis){
 if(scope.__horseRideNgrokTransport||typeof scope.fetch!=='function')return
 const original=scope.fetch,RequestClass=scope.Request||globalThis.Request,HeaderClass=scope.Headers||globalThis.Headers
 scope.fetch=function(input,init){
  let url;try{url=new URL(typeof input==='string'||input instanceof URL?String(input):input.url,scope.location?.href)}catch{return original.call(scope,input,init)}
  if(url.protocol!=='https:'||!/(^|\.)ngrok(?:-free)?\.(?:app|dev|io)$/.test(url.hostname)||!url.pathname.startsWith('/api/'))return original.call(scope,input,init)
  const headers=new HeaderClass(init?.headers||(RequestClass&&input instanceof RequestClass?input.headers:undefined));headers.set('ngrok-skip-browser-warning','1')
  return original.call(scope,input,{...init,headers})
 }
 scope.__horseRideNgrokTransport=true
}
if(typeof window!=='undefined')installNgrokTransport(window)
