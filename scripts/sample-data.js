import { LISTS, TIER_POINTS } from '../site/rankings.js';

// Served only by the local preview server, outside the GitHub Pages artifact.
export function sampleSnapshot() {
  const tiers = Object.keys(TIER_POINTS).reverse();
  const players = tiers.map((_, index) => ({
    uuid: String(index + 1).padStart(32, '0'), username: `DemoArcher${String(index + 1).padStart(2, '0')}`
  }));
  return { schemaVersion: 1, generatedAt: null, demo: true, players,
    tierLists: LISTS.map(([slug, name], listIndex) => ({ slug, name, description: '', inviteUrl: null,
      players: players.map((player, index) => ({ ...player, tier: tiers[(index + listIndex) % tiers.length] }))
    })) };
}
