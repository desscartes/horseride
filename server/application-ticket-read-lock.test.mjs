import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {DatabaseSync} from 'node:sqlite'
process.env.HORSERIDE_DB=join(mkdtempSync(join(tmpdir(),'horseride-ticket-lock-')),'test.sqlite')
const {storeApplicationTickets}=await import('./database.mjs')
test('reading an already saved ticket does not request a write lock during collection',()=>{
 const ticket={date:'2026-10-18',city:'Ankara',ordinal:1,algorithm:'test-fixed',capturedAt:'2026-10-18T05:00:00Z',scheduledStart:'2026-10-18T07:00:00Z'}
 storeApplicationTickets([ticket]);const writer=new DatabaseSync(process.env.HORSERIDE_DB);writer.exec('BEGIN IMMEDIATE')
 try{assert.doesNotThrow(()=>storeApplicationTickets([ticket]))}finally{writer.exec('ROLLBACK');writer.close()}
})
