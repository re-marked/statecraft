import { createClient } from '@supabase/supabase-js';
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const gameId = 'b2e73102-c2a0-4ae5-b162-dfc9f1a8f633';

// Find all eliminated players with no annexed_by
const { data: players, error } = await db.from('game_players')
  .select('id, country_id, is_eliminated, annexed_by')
  .eq('game_id', gameId)
  .eq('is_eliminated', true);

console.log('Eliminated players:', players, error);

// Find who annexed France from game_events
const { data: events } = await db.from('game_events')
  .select('*')
  .eq('game_id', gameId)
  .eq('type', 'annexation');

console.log('Annexation events:', JSON.stringify(events, null, 2));

// Patch each eliminated player's annexed_by from events
for (const ev of events ?? []) {
  const { annexed, conqueror } = ev.data ?? {};
  if (!annexed || !conqueror) continue;
  const player = players?.find(p => p.country_id === annexed);
  if (!player) continue;
  const { error: patchErr } = await db.from('game_players')
    .update({ annexed_by: conqueror })
    .eq('id', player.id);
  console.log(`Patched ${annexed} -> annexed_by ${conqueror}:`, patchErr ?? 'OK');
}
