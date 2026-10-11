import { readFile } from 'node:fs/promises';
import { publishRankings, verifyRankingsFeed } from './github-rankings.js';

try {
  const snapshot = JSON.parse(await readFile('site/data/tiers.json', 'utf8'));
  const result = await publishRankings(snapshot, { repository: process.env.GITHUB_REPOSITORY, token: process.env.RANKINGS_GITHUB_TOKEN });
  console.log(`Public rankings ${result.changed ? 'published' : 'already published'}: ${snapshot.generatedAt}, commit ${result.commit}.`);
  await verifyRankingsFeed(snapshot);
  console.log('Live public rankings feed confirmed.');
} catch (error) {
  console.error(error.name === 'Error' && !error.code ? error.message : 'Public rankings publication failed; check the export and workflow permissions.');
  process.exitCode = 1;
}
