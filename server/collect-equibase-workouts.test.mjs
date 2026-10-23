import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {collectEquibaseWorkouts} from './collect-equibase-workouts.mjs'
const root='https://tvg.equibase.com',page=n=>`${root}/static/workout/GP100${n}26USA-EQB.html`
const index='<a href="/static/workout/GP-calendar.html">GP</a>'+[1,2,3,4].map(n=>`<a href="${page(n)}">day</a>`).join('')
const html=n=>`<div id="c-workouts-by-track"><h2>October ${n}, 2026</h2></div>`
test('bounded collection resumes unvisited pages; blocked source is backed off; cached pages need no request',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'workout-queue-')),calls=[]
 const fetchImpl=async url=>{calls.push(url);if(url.endsWith('index.html'))return {ok:true,text:async()=>index};if(url===page(1))return {ok:false,status:403};return {ok:true,text:async()=>html(Number(url.match(/GP100([1-4])/)[1]))}}
 try{
 const a=await collectEquibaseWorkouts({directory,fetchImpl,maxPages:2});assert.equal(a.attemptedPages,2);assert.equal(a.remainingPages,2);assert.equal(a.failures[0].error,'HTTP 403')
 const b=await collectEquibaseWorkouts({directory,fetchImpl,maxPages:2});assert.equal(b.deferredBackoff,1);assert.ok(calls.includes(page(3)));assert.ok(calls.includes(page(4)));assert.equal(calls.filter(u=>u===page(1)).length,1)
 await collectEquibaseWorkouts({directory,fetchImpl});assert.equal(calls.filter(u=>u===page(2)).length,1);assert.equal(calls.filter(u=>u===page(3)).length,1);assert.equal(JSON.parse(await readFile(directory+'/queue.json','utf8')).attempted[page(1)].retryAfter>Date.now(),true)
 }finally{await rm(directory,{recursive:true,force:true})}
})
