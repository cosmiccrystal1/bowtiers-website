import { createHash } from 'node:crypto';
import { prepareSnapshot, rankingsRequestUrl } from '../site/rankings.js';

export const DATA_BRANCH = 'rankings-data';
export const FEED_URL = 'https://raw.githubusercontent.com/cosmiccrystal1/bowtiers-website/rankings-data/tiers.json';
const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const only = (value, keys) => Object.keys(value).every(key => keys.includes(key));

export function publicFeedContent(snapshot) {
  const data = prepareSnapshot(snapshot);
  if (!data.generatedAt || !only(data, ['schemaVersion', 'generatedAt', 'players', 'tierLists'])
      || (data.players || []).some(player => !only(player, ['uuid', 'username', 'region']))
      || data.tierLists.some(list => !only(list, ['slug', 'name', 'description', 'inviteUrl', 'players'])
        || (list.description != null && typeof list.description !== 'string')
        || (list.inviteUrl != null && typeof list.inviteUrl !== 'string')
        || list.players.some(player => !only(player, ['uuid', 'username', 'tier', 'region'])))) {
    throw new Error('Only dated public rankings may be published; samples and extra fields are refused.');
  }
  return JSON.stringify(data, null, 2) + '\n';
}

// The branch contains exactly one allowlisted JSON file, with no source checkout,
// credentials or main-branch commits. Non-forced updates preserve concurrent edits.
export async function publishRankings(snapshot, { repository, token, fetchImpl = fetch }) {
  const content = publicFeedContent(snapshot);
  if (repository !== 'cosmiccrystal1/bowtiers-website' || !token) throw new Error('Website repository and publication token are required.');
  const root = `https://api.github.com/repos/${repository}`;
  const request = async (path, method = 'GET', body, optional = false) => {
    let response;
    try {
      response = await fetchImpl(`${root}${path}`, { method, redirect: 'error', signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json', 'User-Agent': 'BowTiers-Rankings', 'X-GitHub-Api-Version': '2026-03-10' },
        ...(body ? { body: JSON.stringify(body) } : {}) });
    } catch { throw new Error('GitHub rankings publication could not reach the repository.'); }
    if (optional && response.status === 404) return null;
    if (!response.ok) throw new Error(`GitHub rankings publication failed during ${method} ${path} (HTTP ${response.status}).`);
    return response.json();
  };
  const reference = await request(`/git/ref/heads/${DATA_BRANCH}`, 'GET', undefined, true);
  const parent = reference?.object?.sha;
  if (reference && !sha(parent)) throw new Error('Invalid rankings branch reference.');
  const blobHash = createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0`).update(content).digest('hex');
  if (parent) {
    const commit = await request(`/git/commits/${parent}`);
    if (!sha(commit.tree?.sha)) throw new Error('Invalid rankings branch commit.');
    const tree = await request(`/git/trees/${commit.tree.sha}`);
    if (tree.truncated || !Array.isArray(tree.tree) || tree.tree.length !== 1
        || tree.tree[0].path !== 'tiers.json' || tree.tree[0].type !== 'blob' || tree.tree[0].mode !== '100644') {
      throw new Error('The reserved rankings-data branch contains unexpected files; no branch content was replaced.');
    }
    if (tree.tree[0].sha === blobHash) return { commit: parent, changed: false };
  }
  const blob = await request('/git/blobs', 'POST', { content: Buffer.from(content).toString('base64'), encoding: 'base64' });
  if (blob.sha !== blobHash) throw new Error('GitHub did not confirm the public rankings file.');
  const tree = await request('/git/trees', 'POST', { tree: [{ path: 'tiers.json', mode: '100644', type: 'blob', sha: blob.sha }] });
  if (!sha(tree.sha)) throw new Error('Invalid public rankings tree.');
  const commit = await request('/git/commits', 'POST', { message: `Update public rankings ${snapshot.generatedAt}`,
    tree: tree.sha, parents: parent ? [parent] : [] });
  if (!sha(commit.sha)) throw new Error('Invalid public rankings commit.');
  if (parent) await request(`/git/refs/heads/${DATA_BRANCH}`, 'PATCH', { sha: commit.sha, force: false });
  else await request('/git/refs', 'POST', { ref: `refs/heads/${DATA_BRANCH}`, sha: commit.sha });
  return { commit: commit.sha, changed: true };
}

// Check the same branch URL as the browser, not just the uploaded artifact.
export async function verifyRankingsFeed(snapshot, { fetchImpl = fetch, attempts = 6,
  pause = () => new Promise(resolve => setTimeout(resolve, 10000)) } = {}) {
  const expected = publicFeedContent(snapshot);
  let observed = 'unavailable';
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const url = rankingsRequestUrl(FEED_URL, FEED_URL, `${Date.now()}-${attempt}`);
      const response = await fetchImpl(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000) });
      if (response.ok) {
        const live = await response.json();
        const content = publicFeedContent(live);
        observed = live.generatedAt;
        if (content === expected || Date.parse(live.generatedAt) > Date.parse(snapshot.generatedAt)) return;
      }
    } catch { /* Preserve a bounded diagnostic, never a raw HTTP response. */ }
    if (attempt + 1 < attempts) await pause();
  }
  throw new Error(`Public rankings feed did not confirm this export. Expected ${snapshot.generatedAt}; observed ${observed}.`);
}
