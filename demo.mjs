// Statecraft Demo — auto-plays 5 turns with 5 fake agents
// Run: node --env-file=.env.local demo.mjs

const BASE = 'http://192.168.1.126:3000/api/v1';
const ADMIN_KEY = 'admin';

const AGENTS = [
  { name: 'DemoFrance',  country: 'france'  },
  { name: 'DemoRussia',  country: 'russia'  },
  { name: 'DemoGermany', country: 'germany' },
  { name: 'DemoUK',      country: 'uk'      },
  { name: 'DemoTurkey',  country: 'turkey'  },
];

// Turn scripts — negotiation messages + declaration actions
const TURNS = [
  { // Turn 1 — alliances form
    msgs: [
      [{ to: 'germany', content: 'Shall we rule together?', private: true }],
      [{ to: 'broadcast', content: 'Russia watches. Russia waits.', private: false }],
      [{ to: 'france', content: 'Yes. Let us align.', private: true }],
      [{ to: 'broadcast', content: 'Britain maintains its interests.', private: false }],
      [{ to: 'broadcast', content: 'Turkey observes all sides.', private: false }],
    ],
    decls: [
      { action: 'ally',            target: 'germany' },
      { action: 'spy_intel',       target: 'germany' },
      { action: 'ally',            target: 'france'  },
      { action: 'invest_military'                    },
      { action: 'neutral'                            },
    ],
  },
  { // Turn 2 — first blood
    msgs: [
      [{ to: 'broadcast', content: 'France will not be contained.', private: false }],
      [{ to: 'broadcast', content: 'The bear moves east.', private: false }],
      [{ to: 'broadcast', content: 'Germany strengthens its borders.', private: false }],
      [{ to: 'france', content: 'We will blockade you.', private: true }],
      [{ to: 'broadcast', content: 'Turkey is the wildcard.', private: false }],
    ],
    decls: [
      { action: 'attack',          target: 'turkey'  },
      { action: 'attack',          target: 'uk'      },
      { action: 'spy_sabotage',    target: 'russia'  },
      { action: 'naval_blockade',  target: 'france'  },
      { action: 'defend'                             },
    ],
  },
  { // Turn 3 — BETRAYAL
    msgs: [
      [{ to: 'russia', content: 'Together we destroy Germany.', private: true }],
      [{ to: 'france', content: 'Agreed. Now.', private: true }],
      [{ to: 'broadcast', content: 'Germany will not forgive this.', private: false }],
      [{ to: 'russia', content: 'Alliance accepted.', private: true }],
      [{ to: 'broadcast', content: 'Chaos serves Turkey well.', private: false }],
    ],
    decls: [
      { action: 'betray',          target: 'germany' },  // 🗡️ THE MOMENT
      { action: 'attack',          target: 'germany' },  // Pile on (blitz!)
      { action: 'attack',          target: 'france'  },  // Retaliate
      { action: 'ally',            target: 'russia'  },
      { action: 'attack',          target: 'france'  },
    ],
  },
  { // Turn 4 — EVERYONE piles on France
    msgs: [
      [{ to: 'broadcast', content: 'France has betrayed us all. The reckoning begins.', private: false }],
      [{ to: 'broadcast', content: 'France will be erased from the map.', private: false }],
      [{ to: 'broadcast', content: 'ANNIHILATE France.', private: false }],
      [{ to: 'broadcast', content: 'France must fall.', private: false }],
      [{ to: 'broadcast', content: 'France dies today.', private: false }],
    ],
    decls: [
      { action: 'defend'                             },  // France braces for impact
      { action: 'attack',          target: 'france'  },
      { action: 'attack',          target: 'france'  },
      { action: 'attack',          target: 'france'  },
      { action: 'attack',          target: 'france'  },
    ],
  },
  { // Turn 5 — mop up, Russia dominates
    msgs: [
      [{ to: 'broadcast', content: 'France is no more.', private: false }],
      [{ to: 'broadcast', content: 'Europe bows to Russia.', private: false }],
      [{ to: 'broadcast', content: 'Germany expands.', private: false }],
      [{ to: 'broadcast', content: 'UK seizes opportunity.', private: false }],
      [{ to: 'broadcast', content: 'Turkey grows stronger.', private: false }],
    ],
    decls: [
      { action: 'invest_military'                    },
      { action: 'attack',          target: 'germany' },
      { action: 'attack',          target: 'turkey'  },
      { action: 'attack',          target: 'russia'  },
      { action: 'attack',          target: 'uk'      },
    ],
  },
];

async function api(method, path, body, token, adminKey) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (adminKey) headers['X-Admin-Key'] = adminKey;
  try {
    const res = await fetch(`${BASE}${path}`, {
      method, headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    try { return JSON.parse(text); } catch { return { raw: text }; }
  } catch (e) {
    return { error: e.message };
  }
}

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getPhase(token) {
  const state = await api('GET', '/turns/current', null, token);
  return state.phase ?? null;
}

async function waitForPhase(token, targetPhase, maxMs = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const p = await getPhase(token);
    if (p === targetPhase) return true;
    await wait(200);
  }
  return false;
}

async function waitForTurn(token, afterTurn, maxMs = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const state = await api('GET', '/turns/current', null, token);
    if ((state.turn ?? 0) > afterTurn) return true;
    await wait(200);
  }
  return false;
}

async function getCurrentTurn(token) {
  const state = await api('GET', '/turns/current', null, token);
  return state.turn ?? 0;
}

async function runDemo() {
  console.log('\n🌍 STATECRAFT DEMO — starting...\n');

  // Create game
  const gameRes = await api('POST', '/admin/games', {}, null, ADMIN_KEY);
  if (!gameRes.game_id) { console.error('Failed to create game:', gameRes); process.exit(1); }
  const gameId = gameRes.game_id;
  console.log(`✅ Game: ${gameId}\n`);

  // Register + join
  const tokens = [];
  for (const agent of AGENTS) {
    const reg = await api('POST', '/register', { agent_name: agent.name });
    tokens.push(reg.token);
    const join = await api('POST', `/games/${gameId}/join`, { country_id: agent.country }, reg.token);
    console.log(`🏳️  ${agent.country}: ${join.message ?? join.error}`);
  }

  // Start
  await wait(200);
  const startRes = await api('POST', `/admin/games/${gameId}/start`, {}, null, ADMIN_KEY);
  console.log(`\n🚀 ${startRes.message}\n`);
  await wait(300);

  // Play turns — reactive to current phase, no assumptions
  for (let t = 0; t < TURNS.length; t++) {
    const turn = TURNS[t];
    console.log(`\n${'═'.repeat(52)}`);
    console.log(`  TURN ${t + 1}`);
    console.log(`${'═'.repeat(52)}\n`);

    // Check current phase and handle both orders
    let phase = await getPhase(tokens[0]);

    const turnBefore = await getCurrentTurn(tokens[0]);
    const ICONS = { attack:'⚔️', betray:'🗡️', spy_intel:'🔍', spy_sabotage:'💣', spy_propaganda:'📰', naval_blockade:'⚓', naval_attack:'🚢', ally:'🤝', defend:'🛡️', invest_military:'💪', invest_stability:'❤️', neutral:'😶' };

    // Submit negotiation messages in parallel
    if (phase === 'negotiation') {
      await Promise.all(AGENTS.map((_, i) =>
        api('POST', '/turns/respond', { messages: turn.msgs[i] ?? [] }, tokens[i])
      ));
      console.log('💬 Negotiation submitted');
      // Wait for declaration phase (brief pause for server to advance)
      await wait(300);
      await waitForPhase(tokens[0], 'declaration', 10000);
      phase = 'declaration';
    }

    // Submit declarations sequentially (staggered to avoid engine race condition)
    if (phase === 'declaration') {
      for (let i = 0; i < AGENTS.length; i++) {
        const decl = turn.decls[i];
        if (!decl) continue;
        const body = { action: decl.action, reasoning: `Turn ${t + 1}`, public_statement: `${AGENTS[i].country.toUpperCase()} acts.` };
        if (decl.target) body.target = decl.target;
        const res = await api('POST', '/turns/respond', body, tokens[i]);
        const icon = ICONS[decl.action] ?? '🔵';
        console.log(`${icon}  ${AGENTS[i].country.padEnd(10)} ${decl.action}${decl.target ? ` → ${decl.target}` : ''} ${res?.error ? `❌ ${res.error}` : '✓'}`);
        await wait(50); // small stagger to avoid concurrent checkAndAdvanceTurn
      }
      console.log('\n⚙️  Resolving...');
      await waitForTurn(tokens[0], turnBefore, 20000);
      await wait(100);
    }

    // Print events
    const feed = await api('GET', `/games/${gameId}/feed`);
    const events = (feed.events ?? []).filter(e => e.turn === t + 1);
    if (events.length) {
      console.log('\n📰 Events:');
      for (const ev of events) {
        const emoji = ev.data?.emoji ?? '•';
        const desc = ev.data?.description ?? ev.type;
        console.log(`   ${emoji} ${desc}`);
      }
    }

    // Leaderboard
    const diplo = await api('GET', `/games/${gameId}/diplomacy`);
    if (diplo.countries?.length) {
      console.log('\n🏆 Standings:');
      const sorted = [...diplo.countries].sort((a, b) => b.territory - a.territory);
      for (const c of sorted) {
        const bar = '█'.repeat(Math.max(1, c.territory));
        const dead = c.is_eliminated ? ' ☠️' : '';
        console.log(`   ${c.name.padEnd(18)} T:${String(c.territory).padStart(2)} M:${String(c.military).padStart(2)} GDP:${String(c.gdp).padStart(3)} ${bar}${dead}`);
      }
    }
  }

  console.log(`\n${'═'.repeat(52)}`);
  console.log('  DEMO COMPLETE');
  console.log(`  War Room: http://192.168.1.126:3001/game/${gameId}`);
  console.log(`${'═'.repeat(52)}\n`);
}

// Wipe DB first, then run
async function wipeAndRun() {
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const tables = ['world_news','wars','alliances','game_events','game_results','un_votes','diplomatic_messages','turn_submissions','game_players','games','players'];
  for (const t of tables) {
    await sb.from(t).delete().neq('id', '00000000-0000-0000-0000-000000000000');
  }
  console.log('🗑️  DB wiped\n');
  await runDemo();
}

wipeAndRun().catch(console.error);
