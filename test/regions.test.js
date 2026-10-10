import test from 'node:test';
import assert from 'node:assert/strict';
import { publicSnapshot } from '../scripts/public-data.js';
import { overallPlayers, prepareSnapshot } from '../site/rankings.js';

test('overall uses the latest global choice while individual lists retain their own regions', () => {
  const snapshot = publicSnapshot([{ id: 1, slug: 'bow', name: 'Classic Bow' }, { id: 2, slug: 'iron', name: 'Iron' }], [
    { tier_list_id: 1, minecraft_uuid: 'a', minecraft_username: 'Alpha', tier: 'HT3', region: 'NA' },
    { tier_list_id: 2, minecraft_uuid: 'a', minecraft_username: 'Alpha', tier: 'LT3', region: 'EU' }
  ], new Date(), [{ minecraft_uuid: 'a', minecraft_username: 'Alpha', region: 'EU', discord_id: 'PRIVATE' }]);
  assert.equal(overallPlayers(prepareSnapshot(snapshot))[0].region, 'EU');
  assert.equal(snapshot.tierLists[0].players[0].region, 'NA');
  assert.equal(snapshot.tierLists[1].players[0].region, 'EU');
  assert.ok(!JSON.stringify(snapshot).includes('PRIVATE'));
  delete snapshot.players;
  assert.equal(overallPlayers(snapshot)[0].region, null); // No guessed latest region from list order.
});

test('unknown regions remain null and invalid refresh values cannot replace the current snapshot', () => {
  const data = publicSnapshot([], [], new Date(), [{ minecraft_uuid: 'a', minecraft_username: 'Alpha', region: 'PRIVATE' }]);
  assert.equal(data.players[0].region, null); assert.ok(!JSON.stringify(data).includes('PRIVATE'));
  for (const region of ['', 'US', 42, {}]) assert.throws(() => prepareSnapshot({ schemaVersion: 1, tierLists: [], players: [{ uuid: 'a', username: 'Alpha', region }] }));
  assert.doesNotThrow(() => prepareSnapshot({ schemaVersion: 1, tierLists: [], players: [{ uuid: 'a', username: 'Alpha' }] }));
});
