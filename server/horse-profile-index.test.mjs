import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
import {createProfileReader} from './horse-profile-index.mjs';
test('profile lookup preserves newest valid JSON across exact horse IDs and URL variants',()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE source_snapshots(source TEXT,provider_url TEXT,raw_content TEXT,fetched_at TEXT);CREATE INDEX lookup ON source_snapshots(source,provider_url,fetched_at DESC)');
 const insert=db.prepare('INSERT INTO source_snapshots VALUES(?,?,?,?)');
 insert.run('workout','https://www.tjk.org/a?QueryParameter_AtId=12','{"value":1}','2026-11-01');
 insert.run('workout','https://www.tjk.org/b?Era=today&QueryParameter_AtId=12','{"value":2}','2026-11-02');
 insert.run('workout','https://www.tjk.org/b?Era=today&QueryParameter_AtId=12','broken','2026-11-03');
 insert.run('workout','https://www.tjk.org/a?QueryParameter_AtId=123','{"value":999}','2026-11-04');
 let clock=0;const read=createProfileReader(db,{now:()=>clock,maxAgeMs:60});
 assert.deepEqual(read(12,'workout'),{value:2});assert.equal(read(1,'workout'),null);
 insert.run('workout','https://www.tjk.org/c?QueryParameter_AtId=12','{"value":3}','2026-11-05');clock=61;
 assert.deepEqual(read(12,'workout'),{value:3});db.close();
});
