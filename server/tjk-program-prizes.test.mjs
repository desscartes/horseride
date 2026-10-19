import test from 'node:test'
import assert from 'node:assert/strict'
process.env.HORSERIDE_NO_LISTEN='1'
const {parseCsv}=await import('./index.mjs')
test('program CSV preserves runner prizes without confusing breeder premiums',()=>{
 const csv='Ankara;(1. Yarış Günü);04/09/2026\n1. Kosu : 14.00;Maiden;3 Yaşlı İngilizler;58kg;1200m;Çim\nİkramiye;;;;;Yetiştirici Primi\n1.)100.000 TL;2.)40.000 TL;3.)20.000 TL;4.)10.000 TL;5.)5.000 TL;1.)30.000 TL\nAt No;At İsmi;Yaş;Orijin(Baba);Orijin(Anne);Kilo;Jokey Adı;St\n1;TEST HORSE;3y d e;SIRE;DAM;58;JOCKEY;1'
 const p=parseCsv(csv);assert.equal(p.races.length,1);assert.equal(p.races[0].prizeMoney.prizes.length,5);assert.equal(p.races[0].prizeMoney.prizes[0].amount,100000);assert.equal(p.races[0].prizeMoney.prizes[0].currency,'TRY')
})