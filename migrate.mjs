import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

// Try adding via direct SQL through a custom rpc or just update a row with the column
// Supabase doesn't expose DDL via REST, so we use the db client trick:
// Insert a row with annexed_by, which will fail if column doesn't exist
// Instead, let's just try selecting it to confirm status
const { data, error } = await sb.from('game_players').select('annexed_by').limit(1);
if (error) {
  console.log('Column missing, needs migration via dashboard or psql');
  console.log('Error:', error.message);
  
  // Try via rpc exec_sql (may not exist)
  const { error: e2 } = await sb.rpc('exec_sql', {
    sql: 'ALTER TABLE game_players ADD COLUMN IF NOT EXISTS annexed_by TEXT DEFAULT NULL;'
  });
  if (e2) console.log('RPC exec_sql not available:', e2.message);
  else console.log('Migration ran via RPC!');
} else {
  console.log('Column already exists! annexed_by:', data);
}
