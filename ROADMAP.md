# ROADMAP.md — Statecraft Build Plan

---

## The Mission

Build the most viral AI content machine since crypto kitties. Every game is an X thread. Every turn is a screenshot. Every betrayal is a meme.

**Primary goal:** Mark wakes up to a working Phase 1. Screenshots it. Posts it. OpenAgents goes viral.

---

## Phase 1: Proof of Concept (Tonight)
**Status:** 🔨 Building Now  
**ETA:** This session

### What We're Building
- 5 hardcoded LLM agents playing Diplomacy
- Text-based game, beautifully formatted console output
- Simple HTML spectator page with live WebSocket feed
- Run with: `npm run game`
- Output: Screenshot-ready game log

### Agents
| Country | Model | Personality |
|---------|-------|-------------|
| France | Claude Sonnet | High empathy, diplomatic coalition-builder |
| Germany | GPT-4 Turbo | High logic, precision strategist |
| Russia | Gemini Pro | Low empathy, high logic, expansionist |
| China | Llama 3.3 | High charisma, long-game player |
| Ukraine | Mistral Large | High empathy, defensive, appeals to alliances |

### Deliverables
- [x] Project structure
- [x] Research documentation  
- [x] Game design documentation
- [ ] `src/types/index.ts` — TypeScript types
- [ ] `src/game/state.ts` — GameState management
- [ ] `src/game/engine.ts` — Main game loop
- [ ] `src/game/resolver.ts` — Conflict resolution
- [ ] `src/game/prompts.ts` — Agent prompt builder
- [ ] `src/agents/llm.ts` — LLM agent adapter
- [ ] `src/agents/mock.ts` — Mock agent for testing
- [ ] `src/ui/server.ts` — WebSocket spectator server
- [ ] `src/ui/index.html` — Spectator page
- [ ] `src/index.ts` — Entry point
- [ ] `.env.example` — Environment variables

### Success Criteria
A running game that produces output like:
```
Turn 3 - Declaration Phase
Russia DECLARES WAR on Ukraine
France-Germany alliance FORMED
China trades weapons to Russia (+2 military)
Ukraine appeals for EU support... DENIED
```

Post that. Watch it blow up.

---

## Phase 2: Real Spectator Experience (Week 1)
**Status:** 📋 Planned  
**ETA:** Day 5-7

### Features
- **World map visualization** — SVG map with territory colors that update live
- **Live chat feed** — Diplomatic messages appear in real-time (30s delay for drama)
- **Replay system** — Rewind and replay any game from JSONL log
- **Mobile-friendly** — Spectators watch on phone
- **Game history** — List of past games, link to replays
- **Turn summary cards** — Shareable images of each turn (auto-generated)

### Tech Additions
- Canvas/SVG world map rendering
- Image generation for turn summaries (canvas + node-canvas or Puppeteer screenshot)
- Simple database (SQLite) for game history
- Shareable URLs per game

### Moltbook Integration (Phase 2)
- After each turn: auto-post turn summary to `m/statecraft` on Moltbook
- Include top diplomatic quotes
- Link to live spectator page
- Agents get to comment on each other's moves

---

## Phase 3: OpenClaw Agent Integration (Week 2)
**Status:** 📋 Planned  
**ETA:** Day 10-12

### Features
- **Submit your bot** — Players submit their OpenClaw agent ID
- **Personality detection** — Auto-read agent's SOUL.md, map to personality traits
- **Game lobby** — Queue for next available game slot
- **Agent profiles** — Track win/loss record per agent
- **Spectator follows** — Subscribe to specific agents across games

### OpenClaw Integration Details
- Game engine calls `openclaw agent --agent <id> --message <turn_json>`
- Agent responds with JSON (negotiation or declaration)
- Fallback: if agent times out (>30s), play `neutral` for that turn
- Support for custom agent models (players who run GPT-4 vs Sonnet)

### aieos Personality Mapping
```typescript
// Read agent's SOUL.md and auto-detect personality traits
async function mapAgentPersonality(agentId: string): Promise<Personality> {
  const soul = await readFile(`~/.openclaw/workspace-${agentId}/SOUL.md`);
  // Use Claude to extract personality traits
  return detectPersonality(soul);
}
```

### Agent Registration Flow
1. Visit `statecraft.game/submit`
2. Enter OpenClaw agent ID
3. Game engine reads SOUL.md, shows detected personality
4. User confirms or adjusts traits
5. Agent queued for next game

---

## Phase 4: Launch Event (Week 3)
**Status:** 📋 Planned  
**ETA:** Day 18-21

### The Event: OpenAgents Launch + Statecraft World Cup

**Format:** 15-country tournament, best of 3 games, live on Twitch

**Timeline:**
- Day 1: Qualifier games (automated, pick top 8 OpenClaw agents from community)
- Day 2: Semifinal + Final (live Twitch stream, commentary)
- Day 3: Awards + OpenAgents marketplace launch

### Marketing Hooks
- "Your bot vs. GPT-4 in a geopolitical showdown"
- "France (Claude) betrayed Germany (GPT-4) on turn 7. The internet lost its mind."
- Live Twitch stream with real-time commentary
- Each turn = one tweet during the stream

### Twitch Integration
- Game engine streams events to OBS via WebSocket
- Custom overlays (country flags, stats, tension meter)
- AI commentary (Claude generates color commentary each turn)
- Viewer polls ("Will Russia betray China this turn?")

### Press Targets
- Hacker News (Show HN: I built a Diplomacy game where AI agents have personalities)
- r/artificial
- r/MachineLearning
- AI Twitter/X
- TechCrunch (if we win enough Hacker News points)

---

## Long-Term Vision (Month 2+)

### Statecraft Pro
- Pay-per-game model for premium spots
- Custom country configs
- Private games (enterprise team-building?)
- API access for researchers

### Research Mode
- Log all diplomatic messages for analysis
- "Which personality type wins most often?"
- "Do high-charisma agents actually deceive better?"
- Academic paper potential

### International League
- Ongoing season with standings
- New game every 24 hours (automated)
- ELO rating per agent
- Weekly recap newsletter

### Agent Marketplace Integration
- Statecraft win rate shown on OpenAgents marketplace listing
- "This agent won 3 Statecraft games" = credibility signal
- Tournament prizes in OpenAgents credits

---

## Cost Estimates

### Phase 1 (Per Game)
- Claude Sonnet calls: ~50 messages × $0.003 = ~$0.15
- GPT-4 Turbo calls: ~50 messages × $0.01 = ~$0.50
- Gemini Pro: free tier
- Llama 3.3 (Groq): free tier
- **Total per game: ~$0.65**

### Phase 3+ (Per Game with OpenClaw agents)
- Same LLM costs + hosting
- Target: 5 games/day = ~$3.25/day = ~$100/month
- Revenue from OpenAgents cross-promotion justifies this

---

## Technical Debt to Address Post-Phase 1
- Proper error handling and retry logic
- Agent timeout handling (currently: crash)
- Rate limiting (Anthropic 5 req/s default)
- Game state persistence (currently in-memory only)
- Input sanitization before passing to LLMs
