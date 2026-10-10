import test from 'node:test';
import assert from 'node:assert/strict';
import { readSnapshot } from '../scripts/export-snapshot.js';

test('rankings export uses one consistent read-only snapshot and its database timestamp', async () => {
  const calls = [], date = new Date('2026-10-10T12:00:00Z');
  const conn = { query: async sql => { calls.push(sql); return [[{ generated_at: date }]]; }, execute: async sql => {
    calls.push(sql);
    if (sql.startsWith('SELECT id, slug')) return [[{ id: 1, slug: 'bow', name: 'Classic Bow' }]];
    if (sql.includes('FROM bt_rankings')) return [[{ tier_list_id: 1, minecraft_uuid: 'uuid', minecraft_username: 'Player', tier: 'HT3', region: 'EU' }]];
    return [[{ minecraft_uuid: 'uuid', minecraft_username: 'Player', region: 'EU' }]];
  }, commit: async () => calls.push('commit'), rollback: async () => assert.fail('successful read should not roll back') };
  const data = await readSnapshot(conn);
  assert.equal(calls[1], 'START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
  assert.equal(calls[2], 'SELECT UTC_TIMESTAMP(3) AS generated_at'); assert.equal(calls.at(-1), 'commit');
  assert.equal(data.generatedAt, date.toISOString()); assert.equal(data.tierLists[0].players[0].tier, 'HT3');
});

test('a failed export rolls back and never returns a partially read rankings snapshot', async () => {
  let rolledBack = false;
  const conn = { query: async () => [[{ generated_at: new Date() }]], execute: async () => { throw new Error('read failed'); },
    commit: async () => assert.fail('failed read should not commit'), rollback: async () => { rolledBack = true; } };
  await assert.rejects(readSnapshot(conn), /read failed/); assert.ok(rolledBack);
});
