import {readFileSync} from 'node:fs'
export function remoteDeployment(){
 try{
  const value=JSON.parse(readFileSync(new URL('../data/maintenance/remote-server.json',import.meta.url),'utf8'))
  return value.role==='development'&&/^\d{1,3}(\.\d{1,3}){3}$/.test(value.server)?value:null
 }catch{return null}
}
export async function forwardToHome(request,response,deployment){
 try{
  const incoming=new URL(request.url,'http://localhost')
  const target=new URL(`http://${deployment.server}:8788`)
  target.pathname=incoming.pathname;target.search=incoming.search
  let body
  if(!['GET','HEAD'].includes(request.method)){
   const chunks=[];let size=0
   for await(const chunk of request){size+=chunk.length;if(size>65536){response.writeHead(413);return response.end()};chunks.push(chunk)}
   body=Buffer.concat(chunks)
  }
  const result=await fetch(target,{method:request.method,headers:{'content-type':request.headers['content-type']||'application/json'},body,signal:AbortSignal.timeout(30000)})
  response.writeHead(result.status,{'content-type':result.headers.get('content-type')||'application/json','access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type','cache-control':'no-store'})
  response.end(Buffer.from(await result.arrayBuffer()))
 }catch{response.writeHead(502,{'content-type':'application/json','access-control-allow-origin':'*'});response.end(JSON.stringify({error:'Ev sunucusuna ulaşılamadı.'}))}
}
