import { publicSnapshot } from './public-data.js';
import { RANKINGS_QUERY, PLAYERS_QUERY } from './public-queries.js';

export async function readSnapshot(conn) {
  try {
    await conn.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await conn.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
    // All exporters use the database clock at snapshot creation, not their own
    // clocks or the time a delayed export finishes reading.
    const [[stamp]] = await conn.query('SELECT UTC_TIMESTAMP(3) AS generated_at');
    const [lists] = await conn.execute('SELECT id, slug, name, description, invite_url FROM bt_tier_lists WHERE active = TRUE ORDER BY name');
    const [rankings] = await conn.execute(RANKINGS_QUERY);
    const [players] = await conn.execute(PLAYERS_QUERY);
    const snapshot = publicSnapshot(lists, rankings, new Date(stamp.generated_at), players);
    await conn.commit();
    return snapshot;
  } catch (error) { await conn.rollback(); throw error; }
}
