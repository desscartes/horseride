import test from 'node:test'
import assert from 'node:assert/strict'
import {gunzipSync} from 'node:zlib'
import {jsonTransfer} from './json-transfer.mjs'
test('large Turkish program JSON is losslessly compressed when requested',()=>{
 const data={races:Array.from({length:80},(_,no)=>({no,city:'Selangor Malezya',name:'ŞAHİN',reason:'Geçmiş yarış kaydı; bugünkü pist ve mesafe.'}))}
 const result=jsonTransfer(data,'br, gzip, deflate')
 assert.equal(result.headers['Content-Encoding'],'gzip');assert.equal(result.headers.Vary,'Accept-Encoding');assert.deepEqual(JSON.parse(gunzipSync(result.body)),data);assert.equal(result.headers['Content-Length'],result.body.length);assert.ok(result.body.length<JSON.stringify(data).length/3)
})
test('gzip refusal and small health responses stay plain JSON',()=>{
 for(const accept of ['', 'gzip;q=0, br', 'deflate']){const result=jsonTransfer({text:'a'.repeat(3000)},accept);assert.equal(result.headers['Content-Encoding'],undefined);assert.equal(JSON.parse(result.body).text.length,3000)}
 assert.equal(jsonTransfer({ok:true},'gzip').headers['Content-Encoding'],undefined)
})
