import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareSnapshot, latestSnapshot, rankingsRequestUrl } from '../site/rankings.js';

test('live snapshots canonicalize Classic Bow without mutating old data or losing its identity', () => {
  const old = { schemaVersion: 1, tierLists: [{ slug: 'bow', name: 'Bow', players: [{ uuid: 'uuid', username: 'Player', tier: 'LT3' }] }] };
  const next = prepareSnapshot(old);
  assert.equal(next.tierLists[0].name, 'Classic Bow'); assert.equal(old.tierLists[0].name, 'Bow');
  assert.equal(next.tierLists[0].slug, 'bow'); assert.deepEqual(next.tierLists[0].players, old.tierLists[0].players);
});

test('alternating CDN responses never revert a loaded page to older ranks or regions', () => {
  const snapshot = (time, tier, region) => ({ schemaVersion: 1, generatedAt: time, players: [{ uuid: 'uuid', username: 'Player', region }],
    tierLists: [{ slug: 'bow', name: 'Classic Bow', players: [{ uuid: 'uuid', username: 'Player', tier, region }] }] });
  const old = snapshot('2026-10-10T12:00:00.000Z', 'LT3', 'NA');
  const current = snapshot('2026-10-10T12:05:00.000Z', 'HT3', 'EU');
  let visible;
  for (const incoming of [old, current, old, current, old, { schemaVersion: 1, generatedAt: null, tierLists: [] }]) {
    const previous = visible;
    visible = latestSnapshot(visible, incoming);
    if (previous?.generatedAt === current.generatedAt) {
      assert.equal(visible, previous); assert.equal(visible.tierLists[0].players[0].tier, 'HT3'); assert.equal(visible.players[0].region, 'EU');
    }
  }
  const later = snapshot('2026-10-10T12:10:00.000Z', 'LT2', 'NA');
  visible = latestSnapshot(visible, later); assert.equal(visible.tierLists[0].players[0].tier, 'LT2');
  assert.throws(() => latestSnapshot(visible, { ...old, generatedAt: 'invalid' }));
  assert.equal(visible.players[0].region, 'NA');
});

test('refresh URLs bypass reused cache entries and preserve configured feed query parameters', () => {
  const first = new URL(rankingsRequestUrl('./data/tiers.json', 'https://bowtiers.com/?list=bow', 1));
  const second = new URL(rankingsRequestUrl('./data/tiers.json', 'https://bowtiers.com/?list=bow', 2));
  assert.equal(first.pathname, '/data/tiers.json'); assert.notEqual(first.href, second.href);
  const feed = new URL(rankingsRequestUrl('https://feed.example/tiers.json?format=public', 'https://bowtiers.com/', 3));
  assert.equal(feed.searchParams.get('format'), 'public'); assert.equal(feed.searchParams.get('_bt'), '3');
});
test('malformed refreshes are rejected before replacing the visible rankings', () => {
  for (const snapshot of [null, { schemaVersion: 2, tierLists: [] }, { schemaVersion: 1, tierLists: [null] },
    { schemaVersion: 1, tierLists: [{ slug: 'bow', name: 'Bow', players: [{}] }] },
    { schemaVersion: 1, tierLists: [], players: [{}] }]) assert.throws(() => prepareSnapshot(snapshot));
});
