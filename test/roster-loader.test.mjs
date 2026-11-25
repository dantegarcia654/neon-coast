import assert from 'node:assert/strict';
import test from 'node:test';
import {rosterLoader} from '../docs/src/roster-loader.js';

test('returning to a canceled selection keeps the replacement request alive', async () => {
  const transfers=[];
  const roster=rosterLoader((key,signal)=>new Promise((resolve,reject)=>{
    transfers.push({key,signal,resolve,reject});
  }));
  const first=roster.request('jean');
  assert.equal(roster.request('jean'),first);
  roster.prioritize('mara');
  const mara=roster.request('mara');
  assert.ok(transfers[0].signal.aborted);
  roster.prioritize('jean');
  const replacement=roster.request('jean');
  transfers[0].reject(new Error('aborted'));
  await assert.rejects(first,/aborted/);
  assert.equal(roster.request('jean'),replacement);
  assert.ok(transfers[1].signal.aborted);
  transfers[1].reject(new Error('aborted'));
  await assert.rejects(mara,/aborted/);
  transfers[2].resolve('ready');
  assert.equal(await replacement,'ready');
});

test('a failed transfer can be retried',async()=>{
  let attempts=0;
  const roster=rosterLoader(async()=>{if(++attempts===1)throw Error('offline');return 'ready'});
  await assert.rejects(roster.request('car'),/offline/);
  assert.equal(await roster.request('car'),'ready');
});
