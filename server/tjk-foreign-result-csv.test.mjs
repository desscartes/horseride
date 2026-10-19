import test from 'node:test'
import assert from 'node:assert/strict'
import {matchTjkForeignResultCsv} from './tjk-foreign-result-csv.mjs'
const horses=[{no:8,name:'WINNER (AUS)',sire:'SIRE',dam:'DAM'},{no:3,name:'SECOND (NZ)',sire:'SIRE2',dam:'DAM2'},{no:7,name:'THIRD (AUS)',sire:'SIRE3',dam:'DAM3'},{no:1,name:'FOURTH (AUS)',sire:'SIRE4',dam:'DAM4'},{no:6,name:'FIFTH (AUS)',sire:'SIRE5',dam:'DAM5'}]
const csv='Pakenham Avustralya;(0. Yarış Günü);02/04/2026\n1. Kosu 09.15;Maiden\nSıra;At İsmi;Orijin(Baba);Orijin(Anne);Derece\n'+horses.map((h,i)=>`${i+1};${h.name};${h.sire};${h.dam};`).join('\n')
const options={date:'2026-04-02',city:'Pakenham Avustralya',program:[{no:1,horses}],htmlResults:new Map([[1,new Map(horses.slice(0,4).map((h,i)=>[h.no,{finishPosition:i+1}]))]])}
test('CSV placings join to program numbers by name and both parents',()=>{const r=matchTjkForeignResultCsv(csv,options);assert.equal(r.races.get(1).get(8).finishPosition,1);assert.equal(r.races.get(1).get(6).finishPosition,5);assert.equal(r.races.get(1).get(1).finishPosition,4)})
test('HTML disagreement, missing runner and wrong parents reject whole fields',()=>{assert.equal(matchTjkForeignResultCsv(csv.replace('1;WINNER','2;WINNER'),options).races.size,0);assert.equal(matchTjkForeignResultCsv(csv.replace(/\n5;.*$/,''),options).races.size,0);assert.equal(matchTjkForeignResultCsv(csv.replace(';SIRE5;',';WRONG;'),options).races.size,0)})
test('source date and city cannot be relabelled',()=>{assert.throws(()=>matchTjkForeignResultCsv(csv,{...options,date:'2026-04-03'}),/identity mismatch/);assert.throws(()=>matchTjkForeignResultCsv(csv,{...options,city:'Cranbourne Avustralya'}),/identity mismatch/)})
test('At No and row order cannot fabricate finishes beyond independently confirmed runners',()=>{const ambiguous=csv.replace('Sıra;','At No;');const r=matchTjkForeignResultCsv(ambiguous,options);assert.equal(r.races.size,0);assert.ok(r.rejected[0].reasons.includes('unresolved_finish'))})
