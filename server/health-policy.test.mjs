import test from 'node:test'
import assert from 'node:assert/strict'
import {recentOwner,shouldRestartOwnedApi} from './health-policy.mjs'
test('fresh heartbeat protects a live owner even when PID visibility is limited',()=>{
 const now=Date.parse('2026-10-08T09:00:00Z')
 assert.equal(recentOwner({pid:10,heartbeatAt:'2026-10-08T08:59:30Z'},now),true)
 assert.equal(recentOwner({pid:10,heartbeatAt:'2026-10-08T08:00:00Z'},now),false)
 assert.equal(recentOwner({pid:10,heartbeatAt:'2026-10-08T10:00:00Z'},now),false)
 assert.equal(recentOwner({pid:10,heartbeatAt:'2026-10-08T08:59:30Z'},now,now-10000),false)
})
test('only our own API can be restarted, after sustained failure',()=>{
 assert.equal(shouldRestartOwnedApi({owned:false,healthy:false,failures:10}),false)
 assert.equal(shouldRestartOwnedApi({owned:true,healthy:false,failures:2}),false)
 assert.equal(shouldRestartOwnedApi({owned:true,healthy:true,failures:3}),false)
 assert.equal(shouldRestartOwnedApi({owned:true,healthy:false,failures:3}),true)
})
