export const LISTS = [
  ['bow', 'Classic Bow'], ['streetfight', 'Streetfight'], ['totem-race', 'Totem Race'],
  ['iron', 'Iron'], ['crossbow', 'Crossbow'], ['speed-archer', 'Speed Archer'], ['aerial', 'Aerial']
];
export const TIER_POINTS = { LT5: 1, HT5: 2, LT4: 3, HT4: 4, LT3: 6, HT3: 10, LT2: 15, HT2: 20, LT1: 30, HT1: 40 };
export function prepareSnapshot(snapshot) {
  const identity = p => p && typeof p.uuid === 'string' && typeof p.username === 'string';
  if (!snapshot || snapshot.schemaVersion !== 1 || !Array.isArray(snapshot.tierLists)
      || (snapshot.players !== undefined && (!Array.isArray(snapshot.players) || !snapshot.players.every(identity)))
      || snapshot.tierLists.some(t => !t || typeof t.slug !== 'string' || typeof t.name !== 'string'
        || !Array.isArray(t.players) || !t.players.every(p => identity(p) && Object.hasOwn(TIER_POINTS, p.tier)))) {
    throw new Error('Unsupported rankings data');
  }
  return { ...snapshot, tierLists: snapshot.tierLists.map(t => ({ ...t, name: t.slug === 'bow' ? 'Classic Bow' : t.name })) };
}
export function tierColumnPlayers(players, number, profiles) {
  return players.filter(player => player.tier === `HT${number}` || player.tier === `LT${number}`)
    .sort((a, b) => Number(a.tier.startsWith('LT')) - Number(b.tier.startsWith('LT'))
      || (profiles.get(b.uuid)?.score || 0) - (profiles.get(a.uuid)?.score || 0)
      || a.username.localeCompare(b.username) || a.uuid.localeCompare(b.uuid));
}
export function playerTitle({ rank, score }) {
  if (rank === 1 && score > 0) return 'Bow Grandmaster';
  for (const [threshold, title] of [[150, 'Bow Master'], [100, 'Bow Elitist'], [50, 'Bow Warrior'],
    [25, 'Bow Beginner'], [10, 'Bow Rookie'], [0, 'Bow Novice']]) {
    if (score > threshold) return title;
  }
  return 'Unranked';
}

// One identity per Minecraft UUID, including players with no published placements.
export function overallPlayers(snapshot) {
  const players = new Map();
  for (const player of snapshot.players || []) {
    players.set(player.uuid, { uuid: player.uuid, username: player.username, placements: {} });
  }
  for (const list of snapshot.tierLists) {
    for (const player of list.players) {
      if (!players.has(player.uuid)) players.set(player.uuid, { uuid: player.uuid, username: player.username, placements: {} });
      players.get(player.uuid).placements[list.slug] = player.tier;
    }
  }
  const sorted = [...players.values()].map(player => ({ ...player,
    score: LISTS.reduce((total, [slug]) => total + (TIER_POINTS[player.placements[slug]] || 0), 0)
  })).sort((a, b) => b.score - a.score || a.username.localeCompare(b.username) || a.uuid.localeCompare(b.uuid));
  let rank = 0;
  return sorted.map((player, index) => {
    if (index === 0 || player.score !== sorted[index - 1].score) rank = index + 1;
    return { ...player, rank };
  });
}
