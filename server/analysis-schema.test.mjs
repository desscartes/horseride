import test from 'node:test'
import assert from 'node:assert/strict'
import {schemaForRaces} from './analysis-schema.mjs'
test('batch schema bounds race count and limits picks to the correct program',()=>{
  const races=[{city:'Bursa',no:1,horses:[{name:'A'},{name:'B'},{name:'C'},{name:'D'},{name:'E'}],analysisCandidates:['B','A','C','D']},{city:'Bursa',no:2,horses:[{name:'F'},{name:'G'}]}]
  const schema=schemaForRaces(races)
  assert.equal(schema.properties.races.minItems,2)
  assert.equal(schema.properties.races.maxItems,2)
  assert.deepEqual(schema.properties.races.items.anyOf[0].properties.picks.items.properties.horseName.enum,['B','A','C','D'])
  assert.equal(schema.properties.races.items.anyOf[1].properties.picks.maxItems,2)
})
