import test from 'node:test'
import assert from 'node:assert/strict'
import {installNgrokTransport} from '../src/data/ngrokTransport.js'
test('ngrok API header is host and path constrained; existing options and Request headers survive',async()=>{
 const calls=[],scope={fetch:async(...args)=>calls.push(args),Headers,Request,location:{href:'https://localhost/'}}
 const f=scope.fetch;installNgrokTransport(scope);const patched=scope.fetch;installNgrokTransport(scope);assert.equal(scope.fetch,patched)
 for(const url of ['https://example.com/api/health','https://x.ngrok-free.dev.attacker.test/api/health','https://x.ngrok-free.dev/assets/a.js','http://192.168.1.15:8788/api/health']){await scope.fetch(url);assert.equal(calls.at(-1)[1],undefined)}
 const signal=new AbortController().signal;await scope.fetch('https://x.ngrok-free.dev/api/races',{method:'POST',body:'{}',signal,headers:{'content-type':'application/json'}});const init=calls.at(-1)[1];assert.equal(init.headers.get('ngrok-skip-browser-warning'),'1');assert.equal(init.headers.get('content-type'),'application/json');assert.equal(init.signal,signal);assert.equal(init.body,'{}')
 await scope.fetch(new Request('https://x.ngrok-free.app/api/health',{headers:{'x-existing':'yes'}}));assert.equal(calls.at(-1)[1].headers.get('x-existing'),'yes');assert.notEqual(scope.fetch,f)
})
