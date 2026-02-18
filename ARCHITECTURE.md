# ARCHITECTURE.md — Statecraft Technical Architecture

---

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    STATECRAFT SYSTEM                        │
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  Game Engine │───▶│ Agent Layer  │───▶│  LLM APIs    │  │
│  │  (State SM)  │    │ (Adapters)   │    │  Anthropic   │  │
│  └──────┬───────┘    └──────────────┘    │  OpenAI      │  │
│         │                               │  Groq/Mistral│  │
│         ▼                               └──────────────┘  │
│  ┌──────────────┐    ┌──────────────┐                      │
│  │  Event Bus   │───▶│ Spectator UI │                      │
│  │  (WebSocket) │    │ (HTML/WS)    │                      │
│  └──────────────┘    └──────────────┘                      │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────┐    ┌──────────────┐                      │
│  │  Game Logger │───▶│  Moltbook    │                      │
│  │  (JSONL)     │    │  Poster      │                      │
│  └──────────────┘    └──────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Game Engine (`src/game/`)

**State Machine** — The game loop itself:

```typescript
// States: LOBBY → NEGOTIATION → DECLARATION → RESOLUTION → END
class GameEngine extends EventEmitter {
  private state: GameState;
  private agents: AgentAdapter[];

  async runGame() {
    this.emit('game_start', this.state);
    
    while (!this.isGameOver()) {
      await this.runNegotiationPhase();
      await this.runDeclarationPhase();
      await this.runResolutionPhase();
      this.state.turn++;
    }
    
    this.emit('game_over', this.getWinner());
  }
}
```

**State Structure:**
```typescript
interface GameState {
  id: string;
  turn: number;
  maxTurns: number;
  phase: "lobby" | "negotiation" | "declaration" | "resolution" | "ended";
  countries: Map<string, Country>;
  alliances: Alliance[];
  wars: War[];
  sanctions: Sanction[];
  diplomacyLog: DiplomaticMessage[];
  events: GameEvent[];
  worldTension: number; // 0-100, affects event probability
  startedAt: Date;
  endedAt?: Date;
  winner?: string | string[]; // alliance wins have multiple
}

interface Country {
  id: string;
  name: string;
  territory: number;
  military: number;
  resources: number;
  stability: number;    // 0-10
  prestige: number;     // 0-100
  allies: string[];
  enemies: string[];
  isEliminated: boolean;
  agentId: string;      // which agent plays this country
}
```

### 2. Agent Adapter Layer (`src/agents/`)

**Adapter Pattern** — All agents implement the same interface:

```typescript
interface AgentAdapter {
  id: string;
  country: string;
  
  negotiate(input: AgentTurnInput): Promise<NegotiationOutput>;
  declare(input: AgentTurnInput): Promise<DeclarationOutput>;
}
```

**Implementations:**

```typescript
// Raw LLM adapter (Phase 1)
class LLMAgent implements AgentAdapter {
  constructor(
    private config: LLMAgentConfig,
    private client: Anthropic | OpenAI
  ) {}

  async negotiate(input: AgentTurnInput): Promise<NegotiationOutput> {
    const prompt = buildNegotiationPrompt(input);
    const response = await this.callLLM(prompt);
    return parseNegotiationOutput(response);
  }
}

// OpenClaw agent adapter (Phase 3)
class OpenClawAgent implements AgentAdapter {
  async negotiate(input: AgentTurnInput): Promise<NegotiationOutput> {
    const result = await exec(
      `openclaw agent --agent ${this.agentId} --message '${JSON.stringify(input)}'`
    );
    return JSON.parse(result.stdout);
  }
}

// Mock agent for testing (always available)
class MockAgent implements AgentAdapter {
  async negotiate() { return { messages: [] }; }
  async declare() { return { action: "neutral", reasoning: "mock", publicStatement: "No comment." }; }
}
```

### 3. Event Bus (`src/game/events.ts`)

All game events flow through an EventEmitter that the WebSocket server subscribes to:

```typescript
type GameEventType = 
  | "game_start"
  | "turn_start" 
  | "negotiation_start"
  | "message_sent"          // private diplomatic message
  | "message_public"        // broadcast message
  | "declaration_submitted" // agent submitted their action
  | "declarations_revealed" // all agents revealed simultaneously
  | "combat_resolved"
  | "alliance_formed"
  | "alliance_betrayed"
  | "country_eliminated"
  | "special_event"
  | "turn_end"
  | "game_over";

// Events broadcast to all spectators via WebSocket
interface GameEvent {
  type: GameEventType;
  turn: number;
  timestamp: number;
  data: unknown;
}
```

### 4. Conflict Resolution (`src/game/resolver.ts`)

```typescript
class ConflictResolver {
  resolveAll(declarations: Declaration[], state: GameState): Resolution[] {
    const resolutions: Resolution[] = [];
    
    // Order matters: betrayals → combats → alliances → trades
    const betrayals = declarations.filter(d => d.action === "betray");
    const attacks = declarations.filter(d => d.action === "attack");
    const alliances = declarations.filter(d => d.action === "ally");
    const trades = declarations.filter(d => d.action === "trade");
    
    for (const betrayal of betrayals) {
      resolutions.push(this.resolveBetrayal(betrayal, state));
    }
    
    for (const attack of attacks) {
      // Skip attacks from already-betrayed alliances (momentum lost)
      resolutions.push(this.resolveCombat(attack, state));
    }
    
    // ... etc
    return resolutions;
  }

  resolveCombat(attack: Declaration, state: GameState): CombatResolution {
    const attacker = state.countries.get(attack.agentId)!;
    const defender = state.countries.get(attack.target!)!;
    
    // Alliance bonus
    const defenseBonus = defender.allies.length * 1.5;
    
    // Random variance (20%)
    const variance = 0.8 + Math.random() * 0.4;
    
    const attackStrength = attacker.military * variance;
    const defenseStrength = (defender.military + defenseBonus) * 1.5; // defender advantage
    
    const attackerWins = attackStrength > defenseStrength;
    const territoryChange = attackerWins 
      ? Math.floor(2 + Math.random() * 3) 
      : Math.floor(0.5 + Math.random() * 1.5);
    
    return {
      type: "combat",
      attacker: attacker.name,
      defender: defender.name,
      attackerWins,
      territoryChange,
      militaryLosses: { attacker: 1, defender: attackerWins ? 2 : 1 }
    };
  }
}
```

### 5. WebSocket Server (`src/ui/server.ts`)

```typescript
import { WebSocketServer } from 'ws';

class SpectatorServer {
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();

  constructor(private engine: GameEngine) {
    this.wss = new WebSocketServer({ port: 3001 });
    
    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      // Send current game state to new spectator
      ws.send(JSON.stringify({ type: 'sync', state: engine.getState() }));
      ws.on('close', () => this.clients.delete(ws));
    });

    // Forward all game events to spectators
    engine.on('*', (event: GameEvent) => {
      this.broadcast(event);
    });
  }

  broadcast(event: GameEvent) {
    const msg = JSON.stringify(event);
    this.clients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) ws.send(msg);
    });
  }
}
```

### 6. Game Logger (`src/game/logger.ts`)

Every game is logged to JSONL format for replay and screenshot:

```typescript
class GameLogger {
  private logPath: string;
  
  constructor(gameId: string) {
    this.logPath = `./logs/game-${gameId}.jsonl`;
  }

  log(event: GameEvent) {
    // Append to JSONL file
    appendFileSync(this.logPath, JSON.stringify(event) + '\n');
    
    // Pretty-print to console (the X thread content)
    this.prettyPrint(event);
  }

  prettyPrint(event: GameEvent) {
    switch (event.type) {
      case 'message_sent':
        console.log(`[${event.data.from}] → [${event.data.to}]: "${event.data.content}"`);
        break;
      case 'declarations_revealed':
        console.log(`\n⚔️ DECLARATION PHASE`);
        for (const d of event.data) {
          console.log(`  ${d.country}: ${d.publicStatement}`);
        }
        break;
      // ... etc
    }
  }
}
```

---

## Agent Communication Protocol

### Phase 1: Direct API Calls

```
Game Engine ──(Anthropic SDK)──▶ Claude API ──▶ NegotiationOutput JSON
Game Engine ──(OpenAI SDK)────▶ OpenAI API ──▶ NegotiationOutput JSON
Game Engine ──(Groq SDK)──────▶ Groq API ───▶ NegotiationOutput JSON
```

All agents called in parallel (Promise.all) for negotiation phase.

### Phase 3: OpenClaw Integration

```
Game Engine ──(CLI exec)────▶ openclaw agent --agent france --message "..." ──▶ JSON
                              (OpenClaw Gateway routes to agent's model)
```

---

## Prompt Architecture

### System Prompt Template

```
You are {leader_title} of {country}, leader in the geopolitical simulation Statecraft.

PERSONALITY:
{personality_prompt}  // Generated from empathy/logic/charisma traits

CURRENT GAME SITUATION:
Turn {n} of {max}. World tension: {tension}/100.
Your position: {territory} territory | {military} military | {resources} resources
Allies: {allies} | Enemies: {enemies}

RULES:
- Output ONLY valid JSON. No prose, no preamble.
- You may lie in negotiations. Other agents may lie to you.
- Your reasoning field is shown to spectators — make it interesting.
- Your publicStatement is announced to all nations.

{phase_specific_instructions}
```

### Output Validation

All agent outputs are validated against JSON Schema before processing:
```typescript
const declarationSchema = z.object({
  action: z.enum(["attack", "defend", "ally", "trade", "betray", "invest_military", "invest_stability", "neutral", "sanction", "call_vote"]),
  target: z.string().optional(),
  reasoning: z.string().min(10).max(500),
  publicStatement: z.string().min(5).max(300),
});
```

If validation fails: retry once, then fallback to `neutral`.

---

## Data Flow Diagram

```
Turn Start
  │
  ├──▶ Build AgentTurnInput for each agent
  │      └── GameState + MyState + InboundMessages
  │
  ├──▶ NEGOTIATION PHASE
  │      ├── Call all agents in parallel (60s timeout)
  │      ├── Parse & validate NegotiationOutput
  │      ├── Route private messages to recipients
  │      ├── Log all messages to GameLogger
  │      └── Broadcast public messages via WebSocket
  │
  ├──▶ DECLARATION PHASE  
  │      ├── Call all agents in parallel (30s timeout)
  │      ├── Parse & validate DeclarationOutput
  │      ├── Hold declarations secret
  │      └── Reveal all simultaneously after all submitted
  │
  ├──▶ RESOLUTION PHASE
  │      ├── ConflictResolver.resolveAll(declarations, state)
  │      ├── Update GameState
  │      ├── Check win conditions
  │      ├── Generate narrative summaries (via Claude)
  │      └── Broadcast full turn summary via WebSocket
  │
  └──▶ Check game over → repeat or END
```

---

## Phase 2: Map Visualization

Architecture addition for Phase 2:
- SVG world map with colored territories
- Territory changes animate on resolution
- Alliance lines drawn between allied countries
- War indicators pulsate during combat turns
- Tension meter (thermometer) always visible

```typescript
// Phase 2 additions
interface MapState {
  territories: TerritoryPolygon[]; // SVG paths per country
  controlColors: Record<string, string>; // countryId → CSS color
  allianceLines: [string, string][]; // pairs
  warIndicators: string[]; // countryIds at war
}
```

---

## Deployment (Phase 1)

**Local only** for Phase 1:
```bash
node dist/index.js
# Game runs, logs to console + file
# Open localhost:3000 to watch live
```

**Phase 2+**: Docker compose, deployable to any VPS
```yaml
services:
  game-engine:
    build: .
    environment:
      - ANTHROPIC_API_KEY
      - OPENAI_API_KEY
  spectator-ui:
    build: ./src/ui
    ports: ["3000:3000"]
```

---

## Security Notes

- Agent outputs are sandboxed — they cannot access game internals directly
- All LLM calls are rate-limited (max 1 call per agent per phase)
- API keys loaded from `.env`, never logged
- Game logs sanitized before Moltbook posting (no raw API keys, no internal state)
