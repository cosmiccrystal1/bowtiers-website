import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareSnapshot } from '../site/rankings.js';

test('live snapshots canonicalize Classic Bow without mutating old data or losing its identity', () => {
  const old = { schemaVersion: 1, tierLists: [{ slug: 'bow', name: 'Bow', players: [{ uuid: 'uuid', username: 'Player', tier: 'LT3' }] }] };
  const next = prepareSnapshot(old);
  assert.equal(next.tierLists[0].name, 'Classic Bow'); assert.equal(old.tierLists[0].name, 'Bow');
  assert.equal(next.tierLists[0].slug, 'bow'); assert.deepEqual(next.tierLists[0].players, old.tierLists[0].players);
});
test('malformed refreshes are rejected before replacing the visible rankings', () => {
  for (const snapshot of [null, { schemaVersion: 2, tierLists: [] }, { schemaVersion: 1, tierLists: [null] },
    { schemaVersion: 1, tierLists: [{ slug: 'bow', name: 'Bow', players: [{}] }] },
    { schemaVersion: 1, tierLists: [], players: [{}] }]) assert.throws(() => prepareSnapshot(snapshot));
});
