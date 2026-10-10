import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../scripts/feed-worker.js';

test('public feed serves only the exported key, allows browser reads, and prevents caching', async () => {
  const keys = [];
  const env = { RANKINGS: { get: async key => { keys.push(key); return { body: '{"schemaVersion":1}' }; } } };
  const response = await worker.fetch(new Request('https://feed.example/tiers.json'), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
  assert.match(response.headers.get('Cache-Control'), /no-store/);
  assert.deepEqual(await response.json(), { schemaVersion: 1 });
  const head = await worker.fetch(new Request('https://feed.example/tiers.json', { method: 'HEAD' }), env);
  assert.equal(head.status, 200); assert.equal(await head.text(), '');
  for (const [path, method, status] of [['/.env', 'GET', 404], ['/private.sql', 'GET', 404], ['/tiers.json', 'POST', 405]]) {
    const result = await worker.fetch(new Request(`https://feed.example${path}`, { method }), env);
    assert.equal(result.status, status);
  }
  assert.deepEqual(keys, ['tiers.json', 'tiers.json']);
});
test('missing data or storage failure returns a bounded error without leaking diagnostics', async () => {
  for (const get of [async () => null, async () => { throw new Error('SECRET'); }]) {
    const result = await worker.fetch(new Request('https://feed.example/tiers.json'), { RANKINGS: { get } });
    assert.equal(result.status, 503); assert.ok(!(await result.text()).includes('SECRET'));
  }
});
