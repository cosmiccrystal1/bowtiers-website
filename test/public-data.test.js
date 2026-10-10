import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { publicSnapshot } from '../scripts/public-data.js';

test('exports only public fields and keeps independent ranks ordered correctly', () => {
  const privatePlayer = { minecraft_uuid: 'a'.repeat(32), minecraft_username: 'Player', discord_id: 'SECRET', updated_by: 'SECRET', reason: 'SECRET' };
  const lists = [{ id: '1', slug: 'bow', name: 'Bow', guild_id: 'SECRET' }, { id: 2, slug: 'iron', name: 'Iron' }];
  const data = publicSnapshot(lists, [
    { ...privatePlayer, tier_list_id: 1, tier: 'LT5' },
    { ...privatePlayer, tier_list_id: '2', tier: 'HT1' },
    { ...privatePlayer, tier_list_id: '1', tier: 'HT1', minecraft_username: 'Alpha' },
    { ...privatePlayer, tier_list_id: '1', tier: 'INVALID' }
  ]);
  assert.equal(data.tierLists[0].name, 'Classic Bow');
  assert.equal(data.tierLists[0].slug, 'bow');
  assert.equal(data.tierLists[0].players[0].username, 'Alpha');
  assert.equal(data.tierLists[0].players.length, 2);
  assert.equal(data.tierLists[1].players[0].tier, 'HT1');
  assert.ok(!JSON.stringify(data).includes('SECRET'));
  assert.deepEqual(Object.keys(data.tierLists[0].players[0]), ['uuid', 'username', 'tier', 'region']);
});
test('empty tier lists survive export and checked-in data follows the public schema', async () => {
  const result = publicSnapshot([{ id: 1, slug: 'aerial', name: 'Aerial' }], []);
  assert.equal(result.tierLists.length, 1); assert.deepEqual(result.tierLists[0].players, []);
  const seed = JSON.parse(await readFile('site/data/tiers.json', 'utf8'));
  assert.equal(seed.schemaVersion, 1);
  assert.ok(seed.tierLists.every(t => Array.isArray(t.players)));
});
