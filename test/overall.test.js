import test from 'node:test';
import assert from 'node:assert/strict';
import { overallPlayers, TIER_POINTS } from '../site/rankings.js';
import { publicSnapshot } from '../scripts/public-data.js';

test('overall combines placements by UUID and includes unranked database players without private fields', () => {
  const data = publicSnapshot([{ id: 1, slug: 'bow', name: 'Bow' }, { id: 2, slug: 'iron', name: 'Iron' }], [
    { tier_list_id: 1, minecraft_uuid: 'a', minecraft_username: 'Alpha', tier: 'HT1' },
    { tier_list_id: 2, minecraft_uuid: 'a', minecraft_username: 'Alpha', tier: 'LT2' }
  ], new Date('2026-01-01'), [
    { minecraft_uuid: 'z', minecraft_username: 'Zulu', discord_id: 'SECRET' },
    { minecraft_uuid: 'a', minecraft_username: 'Alpha', account_link: 'SECRET' }
  ]);
  assert.deepEqual(overallPlayers(data), [
    { uuid: 'a', username: 'Alpha', placements: { bow: 'HT1', iron: 'LT2' }, score: 55, rank: 1 },
    { uuid: 'z', username: 'Zulu', placements: {}, score: 0, rank: 2 }
  ]);
  assert.ok(!JSON.stringify(data).includes('SECRET'));
  assert.deepEqual(Object.keys(data.players[0]), ['uuid', 'username']);
});

test('overall uses the exact point schedule, sums lists, shares ties and preserves ranks when filtered', () => {
  assert.deepEqual(TIER_POINTS, { LT5: 1, HT5: 2, LT4: 3, HT4: 4, LT3: 6, HT3: 10, LT2: 15, HT2: 20, LT1: 30, HT1: 40 });
  const result = overallPlayers({ tierLists: [
    { slug: 'bow', players: [
      { uuid: 'a', username: 'Alpha', tier: 'HT2' },
      { uuid: 'b', username: 'Beta', tier: 'LT1' },
      { uuid: 'c', username: 'Charlie', tier: 'LT5' }
    ] },
    { slug: 'iron', players: [{ uuid: 'a', username: 'Alpha', tier: 'HT3' }] }
  ] });
  assert.deepEqual(result.map(p => [p.username, p.score, p.rank]), [['Alpha', 30, 1], ['Beta', 30, 1], ['Charlie', 1, 3]]);
  assert.equal(result.filter(p => p.username === 'Charlie')[0].rank, 3);
});

test('overall supports old exports and keeps different UUIDs separate even with matching names', () => {
  const result = overallPlayers({ tierLists: [{ slug: 'bow', players: [
    { uuid: 'a', username: 'Same', tier: 'LT3' }, { uuid: 'b', username: 'Same', tier: 'HT4' }
  ] }] });
  assert.equal(result.length, 2);
  assert.equal(result[0].placements.bow, 'LT3');
  assert.equal(result[1].placements.bow, 'HT4');
  assert.deepEqual(overallPlayers({ tierLists: [] }), []);
});
