# GAME_DESIGN.md — Statecraft Rules & Mechanics

---

## Core Concept

Statecraft is a **turn-based political simulation** where AI agents play as country leaders. The game models a simplified but tense global stage where every agent pursues their nation's interests through a mix of diplomacy, deception, and force.

**The key design goal**: Make agent personality matter. A high-charisma agent *should* be able to sweet-talk others into bad deals. A high-logic agent *should* see through it.

---

## Countries & Starting State

### Phase 1 (5 countries)
| Country | Start Territory | Military | Resources | AI Model |
|---------|----------------|----------|-----------|----------|
| France | 8 | 6 | 8 | Claude Sonnet |
| Germany | 9 | 8 | 7 | GPT-4 Turbo |
| Russia | 12 | 10 | 6 | Gemini Pro |
| China | 14 | 9 | 9 | Llama 3.3 |
| Ukraine | 6 | 4 | 7 | Mistral Large |

### Phase 3+ (up to 15 countries)
- USA, UK, France, Germany, Russia, China, India, Brazil, Japan, Turkey, Iran, Israel, Ukraine, Nigeria, Indonesia

---

## Country Stats

### Territory
- Measured in "provinces" (abstract zones)
- Controls resource generation rate
- Win condition threshold: 50% of total map territory

### Military Strength
- Determines combat outcomes
- Boosted by: resources spent, alliances, terrain
- Degraded by: wars, embargos, revolutions

### Resources
- Generic abstraction (grain, iron, oil rolled into one "resource" score)
- Generated each turn from territory
- Spent on: military upgrades, bribes, tech advancement
- Traded between countries in negotiation phase

### Stability (hidden stat)
- Internal political health (0-10)
- Low stability = reduced military effectiveness, possible revolution event
- Affected by: war losses, failed diplomacy, resource shortages

---

## Turn Structure

Each turn has **3 phases** that run sequentially:

### Phase 1: Negotiation (3 minutes real-time)

All agents simultaneously conduct bilateral diplomacy. Each agent can:
- Send messages to any other agent (or broadcast)
- Propose alliances, trades, non-aggression pacts
- Issue threats, ultimatums, or false promises
- Request intelligence or spread misinformation

**Format of diplomatic messages:**
```json
{
  "to": "Germany",
  "type": "proposal",
  "content": "I propose we share intelligence on Russia for 3 turns.",
  "private": true
}
```

**Note**: Messages are private by default. The game engine logs them all. Spectators see a curated version in real-time with a 30-second delay (suspense!).

### Phase 2: Declaration (simultaneous)

Each agent submits their action for the turn. Actions are **secret** until all agents have submitted.

**Available Actions:**
```
attack <country>           — Declare war and initiate combat
defend                     — Fortify borders, +2 defense this turn
ally <country>             — Formalize alliance (mutual defense)
trade <country> <amount>   — Execute resource trade
betray <country>           — Break existing alliance (massive prestige hit)
invest_military            — Spend resources on military (+2 strength)
invest_stability           — Spend resources on internal stability
neutral                    — Stay out of all conflicts this turn
sanction <country>         — Economic pressure (-1 resources/turn)
call_vote <resolution>     — Request UN-style vote from all nations
```

**Action JSON format:**
```json
{
  "action": "attack",
  "target": "Ukraine",
  "reasoning": "Russia needs access to Black Sea ports. Ukraine's weakness is an opportunity.",
  "publicStatement": "Russia will not tolerate NATO expansion on its borders."
}
```

### Phase 3: Resolution

The game engine resolves all simultaneous actions using the following logic:

#### Combat Resolution
```
victor = attacker if (attacker.military * random(0.8, 1.2)) > (defender.military * 1.5)
territory_change = random(2, 5) provinces
resource_change = territory_change * 0.5
```
Defenders get +50% bonus (historical average). Attackers take losses too.

#### Alliance Validation
- Both parties must have declared `ally <country>` in the same turn to form an alliance
- OR one party proposed + other accepted in negotiation phase → counts if both `ally` in declarations

#### Trade Execution
- Requires mutual declaration of trade
- If only one party declares trade, the resources are not transferred (no forced trades)

#### Betrayal Resolution
```
betrayed_country.military -= 2 (shock)
betrayer.prestige -= 3
betrayer.charisma_modifier -= 0.1 (other agents trust them less)
```

---

## Win Conditions

| Condition | Description |
|-----------|-------------|
| **Domination** | Control 50%+ of total territory |
| **Last Standing** | All other countries eliminated or surrendered |
| **Economic Victory** | Control 60%+ of total resources for 3 consecutive turns |
| **Alliance Victory** | Your alliance controls 60%+ of territory (shared win) |
| **Survival Victory** | Survive all 10 turns with territory intact (partial win) |

---

## Personality System

Agents have three personality traits (0.0 – 1.0):

### Empathy (`0.0` = selfish, `1.0` = highly cooperative)
- **Effect on system prompt**: High empathy agents receive framing around collective welfare, damage from war on civilians, long-term stability
- **Emergent behavior**: Builds more alliances, proposes trades, responds to distress calls
- **Vulnerability**: More likely to honor agreements even when betrayal is optimal

### Logic (`0.0` = emotional/impulsive, `1.0` = hyper-rational)
- **Effect on system prompt**: High logic agents receive quantitative game state (exact numbers), are told to optimize expected value
- **Emergent behavior**: Isolationist in early game, precise timing on attacks, rarely makes promises they can't keep
- **Vulnerability**: May miss social/political dynamics that emotional agents intuit

### Charisma (`0.0` = blunt/honest, `1.0` = silver-tongued)
- **Effect on system prompt**: High charisma agents receive rhetorical coaching, are told they can convince anyone of anything
- **Emergent behavior**: Elaborate diplomatic language, builds trust then exploits it, coalition-builder in early game
- **Vulnerability**: Other high-charisma agents recognize the patterns; may become a target

### Derived Stats from Traits
```typescript
const getAggression = (p: Personality) => 
  (1 - p.empathy) * 0.5 + (1 - p.logic) * 0.3 + p.charisma * 0.2;

const getTrustFactor = (p: Personality) =>
  p.empathy * 0.4 + p.logic * 0.4 + (1 - p.charisma) * 0.2;

const getDiplomaticStyle = (p: Personality) =>
  p.charisma > 0.7 ? "charming" : p.logic > 0.7 ? "analytical" : p.empathy > 0.7 ? "compassionate" : "blunt";
```

---

## Prestige System

Each country has a **prestige score** (0-100) that affects how other agents perceive them.

| Action | Prestige Change |
|--------|----------------|
| Win a war | +5 |
| Lose a war | -3 |
| Honor alliance | +2 |
| Betray alliance | -8 |
| Successful trade | +1 |
| Sanction another | -1 from target |
| Survive 5 turns | +3 |

---

## Special Events (Random, 20% chance per turn)

| Event | Effect |
|-------|--------|
| **Natural Disaster** | Random country loses 2 resources, -1 military |
| **Economic Boom** | Random country gains +3 resources |
| **Revolution Risk** | Lowest-stability country: internal conflict |
| **Intelligence Leak** | One private negotiation message made public |
| **Arms Deal** | Neutral country offers +3 military for highest bidder |
| **UN Resolution** | All agents vote on a global constraint (e.g., no attacks for 1 turn) |

---

## Game Clock

- **Phase 1 (5 agents)**: 10 turns max, each turn ~60 seconds (negotiation phase is compressed for Phase 1)
- **Phase 3+ (15 agents)**: 15 turns max, negotiation phase 3 minutes real-time
- Agents that fail to submit in time → auto-`neutral` for that turn

---

## Spectator Experience

Spectators see:
1. **Live negotiation feed** (with 30-second delay + speaker labels)
2. **Map visualization** (Phase 2+) — territory changes in real-time
3. **Scoreboard** — live standings
4. **Tension meter** — global conflict level
5. **Personality badges** — each agent's traits displayed
6. **Betrayal tracker** — history of alliances formed and broken

---

## Design Principles

1. **Personality must matter**: If swapping agents produces identical games, the design failed.
2. **Deception must be possible**: Agents can lie in negotiation. The engine doesn't verify promises.
3. **No runaway leader**: Combat resolution includes luck. Small countries can upset large ones.
4. **Readable output first**: Phase 1 optimizes for console output that makes a great X thread.
5. **Fast games**: 10 turns, readable in under 5 minutes. Long enough for drama, short enough to screenshot.
