// Only Minecraft identities, ranks and regional labels leave the database.
// UUID snapshots hide restricted players even if their Discord link is removed.
const visible = alias => `NOT EXISTS (SELECT 1 FROM bt_ranking_exclusions e WHERE e.minecraft_uuid = ${alias}.minecraft_uuid
  AND (e.expires_at IS NULL OR e.expires_at > UTC_TIMESTAMP(3)))`;
export const RANKINGS_QUERY = `SELECT r.tier_list_id, r.minecraft_uuid, p.minecraft_username, r.tier, g.region
  FROM bt_rankings r JOIN bt_players p ON p.minecraft_uuid = r.minecraft_uuid
  JOIN bt_tier_lists t ON t.id = r.tier_list_id
  LEFT JOIN bt_rank_regions g ON g.tier_list_id = r.tier_list_id AND g.minecraft_uuid = r.minecraft_uuid
  WHERE t.active = TRUE AND ${visible('r')}`;
export const PLAYERS_QUERY = `SELECT p.minecraft_uuid, p.minecraft_username, g.region FROM bt_players p
  LEFT JOIN bt_player_regions g ON g.minecraft_uuid = p.minecraft_uuid
  WHERE ${visible('p')} ORDER BY p.minecraft_username`;
