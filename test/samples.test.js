import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sampleSnapshot } from '../scripts/sample-data.js';
import { LISTS, TIER_POINTS, overallPlayers } from '../site/rankings.js';

test('local sample covers every tier in every list and keeps one shared identity per player', async () => {
  const sample = sampleSnapshot();
  assert.equal(sample.demo, true);
  assert.equal(sample.players.length, 10);
  assert.deepEqual(sample.tierLists.map(t => t.slug), LISTS.map(([slug]) => slug));
  for (const list of sample.tierLists) {
    assert.deepEqual(new Set(list.players.map(p => p.tier)), new Set(Object.keys(TIER_POINTS)));
    assert.equal(new Set(list.players.map(p => p.uuid)).size, 10);
  }
  const profiles = overallPlayers(sample);
  assert.equal(profiles.length, 10);
  assert.equal(profiles[0].score, 125);
  assert.equal(Object.keys(profiles[0].placements).length, 7);
  const live = JSON.parse(await readFile('site/data/tiers.json', 'utf8'));
  assert.ok(!live.demo);
  assert.ok(!JSON.stringify(live).includes('DemoArcher'));
});
