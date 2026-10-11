import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { publicFeedContent, publishRankings, verifyRankingsFeed, FEED_URL } from '../scripts/github-rankings.js';
import { RANKINGS_URL } from '../site/config.js';

const snapshot = (generatedAt = '2026-10-11T04:04:14.256Z') => ({ schemaVersion: 1, generatedAt,
  players: [{ uuid: 'a'.repeat(32), username: 'PublicPlayer', region: 'NA' }],
  tierLists: [{ slug: 'bow', name: 'Classic Bow', description: '', inviteUrl: null,
    players: [{ uuid: 'a'.repeat(32), username: 'PublicPlayer', region: 'NA', tier: 'LT3' }] }] });
const blobSha = content => createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0`).update(content).digest('hex');

function github({ existing = false, unexpected = false, failUpdate = false } = {}) {
  const parent = '1'.repeat(40), tree = '2'.repeat(40), nextTree = '3'.repeat(40), nextCommit = '4'.repeat(40);
  let head = existing ? parent : null, fileSha = '0'.repeat(40), uploaded;
  const calls = [];
  const fetchImpl = async (url, options) => {
    assert.ok(url.startsWith('https://api.github.com/repos/cosmiccrystal1/bowtiers-website/'));
    assert.equal(options.headers.Authorization, 'Bearer private-test-token');
    const path = new URL(url).pathname.replace('/repos/cosmiccrystal1/bowtiers-website', '');
    const body = options.body ? JSON.parse(options.body) : undefined;
    calls.push({ path, method: options.method, body });
    let status = 200, data;
    if (path === '/git/ref/heads/rankings-data') {
      status = head ? 200 : 404; data = { object: { sha: head } };
    } else if (path.startsWith('/git/commits/')) data = { tree: { sha: tree } };
    else if (path.startsWith('/git/trees/')) data = { tree: [{ path: unexpected ? '.env' : 'tiers.json', mode: '100644', type: 'blob', sha: fileSha }] };
    else if (path === '/git/blobs') {
      assert.equal(body.encoding, 'base64'); uploaded = Buffer.from(body.content, 'base64').toString('utf8');
      data = { sha: blobSha(uploaded) };
    } else if (path === '/git/trees') {
      assert.deepEqual(body.tree, [{ path: 'tiers.json', mode: '100644', type: 'blob', sha: blobSha(uploaded) }]);
      data = { sha: nextTree };
    } else if (path === '/git/commits') {
      assert.equal(body.tree, nextTree); assert.deepEqual(body.parents, head ? [head] : []); data = { sha: nextCommit };
    } else if (path === '/git/refs' || path === '/git/refs/heads/rankings-data') {
      if (failUpdate) status = 409;
      else {
        if (head) assert.equal(body.force, false);
        else assert.equal(body.ref, 'refs/heads/rankings-data');
        head = body.sha; fileSha = blobSha(uploaded); data = { object: { sha: head } };
      }
    } else assert.fail(`Unexpected API call: ${path}`);
    return { status, ok: status < 400, json: async () => {
      assert.ok(status < 400, 'Error response bodies must not be read or exposed'); return data;
    } };
  };
  return { calls, fetchImpl, head: () => head, uploaded: () => uploaded,
    options: { repository: 'cosmiccrystal1/bowtiers-website', token: 'private-test-token', fetchImpl } };
}

test('minute exports create a public-only orphan data branch, then advance it without updating main', async () => {
  const api = github();
  const result = await publishRankings(snapshot(), api.options);
  assert.ok(result.changed); assert.equal(api.head(), result.commit);
  assert.deepEqual(JSON.parse(api.uploaded()), snapshot());
  assert.ok(api.calls.every(call => !call.path.includes('main')));
  const before = api.calls.length;
  const duplicate = await publishRankings(snapshot(), api.options);
  assert.equal(duplicate.changed, false); assert.equal(api.calls.length - before, 3);
  await publishRankings(snapshot('2026-10-11T04:05:14.256Z'), api.options);
  assert.equal(api.calls.at(-1).method, 'PATCH'); assert.equal(api.calls.at(-1).body.force, false);
});

test('an existing data branch is updated without force; unexpected files and rejected updates are preserved', async () => {
  const existing = github({ existing: true }); await publishRankings(snapshot(), existing.options);
  assert.equal(existing.calls.at(-1).path, '/git/refs/heads/rankings-data');
  const unexpected = github({ existing: true, unexpected: true });
  await assert.rejects(publishRankings(snapshot(), unexpected.options), /unexpected files/);
  assert.ok(unexpected.calls.every(call => call.method === 'GET'));
  const conflict = github({ existing: true, failUpdate: true }); const before = conflict.head();
  await assert.rejects(publishRankings(snapshot(), conflict.options), error => {
    assert.match(error.message, /HTTP 409/); assert.ok(!error.message.includes('private-test-token')); return true;
  });
  assert.equal(conflict.head(), before);
});

test('samples, undated placeholders and private fields are refused before any publication request', async () => {
  const invalid = [
    { ...snapshot(), generatedAt: null }, { ...snapshot(), demo: true }, { ...snapshot(), credentials: 'SECRET' },
    { ...snapshot(), players: [{ ...snapshot().players[0], discord_id: 'SECRET' }] },
    { ...snapshot(), tierLists: [{ ...snapshot().tierLists[0], staff: 'SECRET' }] },
    { ...snapshot(), tierLists: [{ ...snapshot().tierLists[0], players: [{ ...snapshot().tierLists[0].players[0], reason: 'SECRET' }] }] }
  ];
  for (const data of invalid) {
    const api = github(); await assert.rejects(publishRankings(data, api.options)); assert.equal(api.calls.length, 0);
  }
  assert.throws(() => publicFeedContent({ ...snapshot(), tierLists: [{ ...snapshot().tierLists[0], description: { private: 'SECRET' } }] }));
});

test('publication connection failures do not echo tokens or raw diagnostics', async () => {
  const options = { repository: 'cosmiccrystal1/bowtiers-website', token: 'private-test-token',
    fetchImpl: async () => { throw new Error('private-test-token and connection secrets'); } };
  await assert.rejects(publishRankings(snapshot(), options), error => {
    assert.match(error.message, /could not reach/); assert.ok(!/token|secrets/.test(error.message)); return true;
  });
});

test('live verification uses the browser feed and waits through stale responses before confirming fresh data', async () => {
  assert.equal(RANKINGS_URL, FEED_URL);
  const urls = []; let pauses = 0;
  await verifyRankingsFeed(snapshot(), { attempts: 2, pause: async () => pauses++, fetchImpl: async (url, options) => {
    urls.push(url); assert.equal(options.cache, 'no-store'); assert.ok(!options.headers?.Authorization);
    return { ok: true, json: async () => urls.length === 1 ? snapshot('2026-10-10T20:01:15.434Z') : snapshot() };
  } });
  assert.equal(pauses, 1); assert.equal(urls.length, 2); assert.notEqual(urls[0], urls[1]);
  assert.equal(new URL(urls[0]).pathname, new URL(FEED_URL).pathname);
});

test('stale or incorrect live content fails the workflow even if publication API reported success', async () => {
  for (const incoming of [snapshot('2026-10-10T20:01:15.434Z'), { ...snapshot(), players: [] }]) {
    await assert.rejects(verifyRankingsFeed(snapshot(), { attempts: 2, pause: async () => {},
      fetchImpl: async () => ({ ok: true, json: async () => incoming }) }), /did not confirm this export/);
  }
});
