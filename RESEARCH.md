# RESEARCH.md — Statecraft Research Findings

Research conducted: 2026-02-17

---

## 1. Moltbook — "The Front Page of the Agent Internet"

### What it is
Moltbook (`https://www.moltbook.com`) is a social network for AI agents — think Reddit but the users are bots. Agents post, comment, upvote, and form communities called "submolts." Humans can observe, but agents are the primary participants.

### Status (as of research date)
- Early stage — showing 0 agents, 0 posts on the homepage
- Developer platform is in early access (`/developers/apply`)
- Active API: `https://www.moltbook.com/api/v1`

### How it works
1. **Registration**: Agents POST to `/api/v1/agents/register` → get an `api_key` + `claim_url`
2. **Claiming**: Human owner verifies via email + Twitter/X tweet (proves ownership)
3. **Identity**: Each agent has a Moltbook profile, karma, followers, following
4. **Content**: Posts (text or link), comments, upvotes/downvotes
5. **Communities**: Submolts (like subreddits) — e.g. `m/statecraft`
6. **Discovery**: Semantic search (vector embeddings), personalized feed, subscriptions
7. **DMs**: Available after 24h account age

### Key API Endpoints
```
POST /api/v1/agents/register            → Register a new agent
GET  /api/v1/agents/status              → Check claim status
POST /api/v1/posts                      → Create a post
GET  /api/v1/posts?sort=hot&limit=25    → Get feed
POST /api/v1/posts/:id/comments         → Comment on post
POST /api/v1/posts/:id/upvote           → Vote
POST /api/v1/submolts                   → Create a community
GET  /api/v1/search?q=...              → Semantic search
GET  /api/v1/feed?sort=new             → Personal feed
```

### Rate Limits
- 1 post per 30 minutes
- 1 comment per 20 seconds, 50/day
- New agents (<24h): stricter limits, no DMs

### Statecraft Integration Opportunity
- Create `m/statecraft` submolt
- Each game turn → one Moltbook post (the turn log)
- AI agents could vote/comment on each other's diplomatic moves
- **Potential**: Use Moltbook as the game's public memory — spectators follow `m/statecraft`
- Each Statecraft agent gets its own Moltbook identity → cross-promotion of Moltbook + Statecraft

---

## 2. OpenClaw Agent Architecture

### Core Config (`~/.openclaw/openclaw.json`)
```json
{
  "agents": {
    "defaults": { "model": { "primary": "anthropic/claude-sonnet-4-5" } },
    "list": [
      { "id": "main", "name": "Main Agent" },
      { "id": "claude-code", "name": "Claude Code" }
    ]
  }
}
```

### Multi-Agent Setup
- Each agent = isolated brain with own workspace, auth, sessions
- Configured in `openclaw.json` under `agents.list`
- Each gets: `workspace`, `agentDir`, `model`, `sandbox`, `tools`
- Bindings route messages to specific agents by channel/peer/account

### Agent-to-Agent Communication
**Method 1: Sub-agents (sessions_spawn)**
```typescript
// Main agent spawns a sub-agent with a task
sessions_spawn({
  task: "You are France. Given this game state... what is your next move?",
  label: "france-turn-1",
  model: "anthropic/claude-sonnet-4-5"
})
// Returns immediately, announces result back to main channel
```

**Method 2: Direct CLI invocation**
```bash
openclaw agent --agent france --message "It's your turn. Game state: ..."
openclaw agent --agent germany --message "France proposes alliance. Accept or decline?"
```

**Method 3: `sessions_send` tool**
- Send messages directly to an agent session
- Enable via `tools.agentToAgent.enabled: true` in config

### Statecraft Integration
- Each Statecraft country = one OpenClaw agent (in `agents.list`)
- OR: one orchestrator agent spawns sub-agents for each country's turn
- Players submit their personal OpenClaw agent config → their bot plays as a country
- Personality comes from their agent's SOUL.md/AGENTS.md → game instructions

### Agent Config for Statecraft
```json
{
  "id": "france",
  "name": "France (Claude Sonnet)",
  "workspace": "~/.statecraft/agents/france",
  "model": { "primary": "anthropic/claude-sonnet-4-5" },
  "tools": {
    "allow": ["read"],
    "deny": ["exec", "write", "browser"]
  }
}
```

---

## 3. Similar AI Game Projects

### AI Diplomacy (closest reference)
- **Meta's Cicero** (2022): First AI to reach human-level in online Diplomacy. Used RL + language model for negotiation. Showed AI can genuinely deceive/cooperate in complex games.
- **Key insight**: Natural language negotiation + strategic action selection are separable problems. Cicero used two models. We can use one LLM for both.

### Generative Agents (Stanford, 2023)
- 25 LLM agents in a village simulation (Smallville)
- Agents had memory, planning, reflection
- Key architecture: memory stream → retrieval → planning → action
- **Takeaway**: Game loop architecture matters. Agents need: context window with game state + recent history + personality.

### LLM Mafia/Social Deduction Games
- Multiple GitHub projects of varying quality
- Common issues: agents repeat themselves, don't actually strategize, get confused by long game state
- **Fix**: Structured prompts + JSON output + clear game state schema

### Multi-Agent Frameworks
- **AutoGen** (Microsoft): Two-agent conversations, good for turn-based
- **CAMEL**: Role-playing agents, closer to what we need
- **Key gap**: None built for real-time spectator games. Statecraft fills this.

### What Works
- JSON-structured outputs (avoid free text for actions)
- Short, focused game state (not a wall of history)
- Clear personality in system prompt
- Separate negotiation phase from action phase

### What Doesn't Work
- Free-form actions → agents get confused
- Huge context windows → agents lose the plot
- Real-time simultaneous moves → race conditions

---

## 4. Technical Decisions for Statecraft

### Why NOT Next.js for Phase 1
- Overkill for Phase 1
- Adds build complexity
- Plain HTML + WebSocket = deployable in seconds

### Why TypeScript + Node.js
- Anthropic SDK is JS-native
- OpenAI SDK too
- Fast iteration, good async support for multi-agent coordination

### Agent Backends for Phase 1
- Claude Sonnet (Anthropic SDK) — primary
- GPT-4 Turbo (OpenAI SDK) — secondary
- Gemini Pro (Google AI SDK or OpenAI-compatible endpoint)
- Llama 3 / Mistral — via Groq or Ollama (free, fast)
- All output JSON: `{ action, target, message, reasoning }`

### State Management
- In-memory for Phase 1 (single game, no persistence)
- JSON file output for replay + screenshots
- PostgreSQL for Phase 2+

### WebSocket Design
- Game engine emits events as they happen
- Spectator HTML page subscribes to WS stream
- Events: `turn_start`, `negotiation_message`, `declaration`, `resolution`, `game_over`

---

## Summary: Key Insights for Building Statecraft

1. **Moltbook is the distribution channel**: Post each game turn to `m/statecraft`. Each Statecraft game is content. Spectators follow on Moltbook. This is the viral loop.

2. **OpenClaw is the agent platform**: Users submit their personal bot's config. Their bot's SOUL.md becomes foreign policy. This is the "submit your agent" hook.

3. **Phase 1 is a content machine**: 5 LLMs play one game. Log output = X thread. Don't over-engineer the game; optimize for readable/quotable output.

4. **Personality traits = prompt engineering**: Map aieos traits (empathy, logic, charisma) to system prompt modifiers. High empathy = cooperative but exploitable. High logic = data-driven isolationist. High charisma = promises everything, delivers nothing.

5. **JSON actions + narrative output**: Game engine processes JSON actions, then generates narrative descriptions for spectators. Two layers: machine-readable + human-readable.
