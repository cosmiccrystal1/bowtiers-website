import { RANKINGS_URL } from '../site/config.js';
import { TIERS } from './public-data.js';

const PROFILE_ROOT = 'https://sessionserver.mojang.com/session/minecraft/profile/';
const uuidKey = value => typeof value === 'string' ? value.replaceAll('-', '').toLowerCase() : '';
const isUuid = value => /^[a-f0-9]{32}$/.test(value);
const isName = value => typeof value === 'string' && /^[A-Za-z0-9_]{3,16}$/.test(value);

async function previousNames(snapshot, fetchProfile, signal) {
  try {
    const url = new URL(RANKINGS_URL);
    url.searchParams.set('before', snapshot.generatedAt);
    const response = await fetchProfile(url.href, { signal, redirect: 'error' });
    if (!response.ok) return new Map();
    const previous = await response.json();
    const timestamp = Date.parse(previous.generatedAt);
    if (previous.schemaVersion !== 1 || !Number.isFinite(timestamp) || timestamp > Date.parse(snapshot.generatedAt)
        || !Array.isArray(previous.players)) return new Map();
    return new Map(previous.players.filter(p => p && isUuid(uuidKey(p.uuid)) && isName(p.username))
      .map(p => [uuidKey(p.uuid), p.username]));
  } catch { return new Map(); }
}

// Refresh after releasing MySQL; a profile service outage must not stop rank publication.
export async function refreshMinecraftNames(snapshot, { fetchProfile = fetch, batchSize = 80 } = {}) {
  const ids = [...new Set([...snapshot.players, ...snapshot.tierLists.flatMap(list => list.players)]
    .map(player => uuidKey(player.uuid)).filter(isUuid))].sort();
  if (!ids.length) return snapshot;
  const previous = previousNames(snapshot, fetchProfile, AbortSignal.timeout(3000));
  const refreshed = new Map();
  const minute = Math.floor(Date.parse(snapshot.generatedAt) / 60000);
  const batch = minute % Math.ceil(ids.length / batchSize);
  const due = ids.slice(batch * batchSize, (batch + 1) * batchSize);
  const budget = AbortSignal.timeout(25000);
  let cursor = 0, throttled = false;
  await Promise.all(Array.from({ length: Math.min(4, due.length) }, async () => {
    while (!budget.aborted && !throttled && cursor < due.length) {
      const uuid = due[cursor++];
      try {
        const response = await fetchProfile(PROFILE_ROOT + uuid, {
          signal: AbortSignal.any([budget, AbortSignal.timeout(3500)]), redirect: 'error'
        });
        if (response.status === 429) { throttled = true; continue; }
        if (!response.ok) continue;
        const profile = await response.json();
        if (uuidKey(profile?.id) === uuid && isName(profile?.name)) refreshed.set(uuid, profile.name);
      } catch { /* Use the last published or database name until another successful lookup. */ }
    }
  }));
  const cached = await previous;
  function named(player) {
    const uuid = uuidKey(player.uuid);
    return { ...player, username: refreshed.get(uuid) ?? cached.get(uuid) ?? player.username };
  }
  return { ...snapshot, players: snapshot.players.map(named), tierLists: snapshot.tierLists.map(list => ({
    ...list, players: list.players.map(named).sort((a, b) => TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier) || a.username.localeCompare(b.username))
  })) };
}
