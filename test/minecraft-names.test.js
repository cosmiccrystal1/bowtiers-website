import test from 'node:test';
import assert from 'node:assert/strict';
import { refreshMinecraftNames } from '../scripts/minecraft-names.js';

const a = 'a'.repeat(32), b = 'b'.repeat(32);
const snapshot = {
  schemaVersion: 1, generatedAt: new Date(120000).toISOString(),
  players: [{ uuid: a, username: 'OldName', region: 'EU' }, { uuid: b, username: 'Other', region: null }],
  tierLists: [{ slug: 'bow', players: [{ uuid: a, username: 'OldName', tier: 'HT1', region: 'NA' }] },
    { slug: 'iron', players: [{ uuid: a, username: 'OldName', tier: 'LT2', region: null }] }]
};
const previous = { ...snapshot, generatedAt: new Date(60000).toISOString(), players: [{ uuid: a, username: 'LastGood' }, { uuid: 'c'.repeat(32), username: 'Excluded' }] };
const ok = data => ({ ok: true, json: async () => data });

test('one validated profile request per UUID refreshes roster and every placement without changing identity', async () => {
  const ids = [];
  const result = await refreshMinecraftNames(snapshot, { fetchProfile: async (url, options) => {
    assert.ok(options.signal);
    if (url.includes('raw.githubusercontent.com')) return ok(previous);
    const id = url.split('/').at(-1); ids.push(id);
    return ok({ id, name: id === a ? 'Renamed' : 'OtherNew', properties: [{ value: 'never publish' }] });
  } });
  assert.deepEqual(ids.sort(), [a, b]);
  assert.deepEqual(result.players, [{ uuid: a, username: 'Renamed', region: 'EU' }, { uuid: b, username: 'OtherNew', region: null }]);
  assert.deepEqual(result.tierLists.map(l => l.players[0].username), ['Renamed', 'Renamed']);
  assert.deepEqual(result.tierLists.map(l => l.players[0].tier), ['HT1', 'LT2']);
  assert.equal(snapshot.players[0].username, 'OldName');
  assert.ok(!JSON.stringify(result).includes('never publish'));
});

test('outage and mismatched UUID fall back to the latest published name or database without adding players', async () => {
  const result = await refreshMinecraftNames(snapshot, { fetchProfile: async url => {
    if (url.includes('raw.githubusercontent.com')) return ok(previous);
    if (url.endsWith(a)) return ok({ id: b, name: 'WrongPlayer' });
    throw new Error('timeout');
  } });
  assert.deepEqual(result.players.map(p => p.username), ['LastGood', 'Other']);
  assert.equal(result.tierLists[0].players[0].username, 'LastGood');
});

test('bounded batches rotate through players instead of repeatedly refreshing the same UUIDs', async () => {
  const ids = [];
  for (const millis of [120000, 180000]) {
    await refreshMinecraftNames({ ...snapshot, generatedAt: new Date(millis).toISOString() }, { batchSize: 1,
      fetchProfile: async url => {
        if (!url.includes('sessionserver.mojang.com')) return { ok: false };
        ids.push(url.split('/').at(-1)); return { ok: false, status: 429 };
      } });
  }
  assert.deepEqual(ids, [a, b]);
});
