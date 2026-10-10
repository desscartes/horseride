import test from 'node:test'
import assert from 'node:assert/strict'
import {normalizeServerAddress} from './serverAddress.js'
test('server address supports LAN and future HTTPS host without embedded credentials',()=>{
 assert.equal(normalizeServerAddress(' http://192.168.1.21:8788 '),'http://192.168.1.21:8788/api/races')
 assert.equal(normalizeServerAddress('https://race.example.com/api/races'),'https://race.example.com/api/races')
 assert.throws(()=>normalizeServerAddress('javascript:alert(1)'))
 assert.throws(()=>normalizeServerAddress('https://user:secret@example.com'))
 assert.throws(()=>normalizeServerAddress('https://example.com/other'))
})
