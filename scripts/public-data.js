export const TIERS = ['HT1', 'LT1', 'HT2', 'LT2', 'HT3', 'LT3', 'HT4', 'LT4', 'HT5', 'LT5'];
export function publicSnapshot(lists, rankings, now = new Date(), players = []) {
  return {
    schemaVersion: 1, generatedAt: now.toISOString(),
    players: players.map(row => ({ uuid: row.minecraft_uuid, username: row.minecraft_username })),
    tierLists: lists.map(list => ({
      slug: list.slug, name: list.slug === 'bow' ? 'Classic Bow' : list.name, description: list.description || '', inviteUrl: list.invite_url || null,
      players: rankings.filter(row => String(row.tier_list_id) === String(list.id) && TIERS.includes(row.tier))
        .map(row => ({ uuid: row.minecraft_uuid, username: row.minecraft_username, tier: row.tier }))
        .sort((a, b) => TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier) || a.username.localeCompare(b.username))
    }))
  };
}
