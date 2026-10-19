import {gzipSync} from 'node:zlib'
export function jsonTransfer(data,acceptEncoding=''){
 const plain=Buffer.from(JSON.stringify(data)),headers={'Content-Type':'application/json; charset=utf-8',Vary:'Accept-Encoding'}
 const gzip=String(acceptEncoding).split(',').some(part=>{const [name,...parameters]=part.trim().split(';');const q=parameters.find(p=>/^\s*q=/i.test(p));return name.toLowerCase()==='gzip'&&(!q||Number(q.split('=')[1])>0)})
 if(gzip&&plain.length>=1024){const compressed=gzipSync(plain,{level:4});if(compressed.length<plain.length){headers['Content-Encoding']='gzip';headers['Content-Length']=compressed.length;return {headers,body:compressed}}}
 headers['Content-Length']=plain.length;return {headers,body:plain}
}
