// ============================================================
// STATECRAFT Demo — Scenario Data
// Chaotic 10-country demo with predefined outcomes
// ============================================================

// ── Config constants (inlined from src/game/config.ts) ───────

export const DEMO_CONFIG = {
  startingPrestige: 50,
  startingInflation: 10,
  startingUnrest: 10,
  startingSpyTokens: 2,
  maxSpyTokens: 5,
  spyTokenRegenPerTurn: 1,
} as const;

export const WIN_CONDITIONS = {
  domination: { territoryPercent: 0.30 },
  economic: { gdpPercent: 0.35 },
} as const;

// ── Types ────────────────────────────────────────────────────

export interface DemoCountryInit {
  id: string;
  name: string;
  flag: string;
  territory: number;
  military: number;
  resources: number;
  naval: number;
  gdp: number;
  stability: number;
}

export interface DemoMessage {
  from: string;
  to: string;
  content: string;
  private: boolean;
}

export type ActionType =
  | 'attack' | 'defend' | 'naval_attack' | 'naval_blockade'
  | 'ally' | 'betray' | 'trade' | 'sanction'
  | 'spy_intel' | 'spy_sabotage' | 'spy_propaganda'
  | 'invest_military' | 'invest_stability' | 'invest_tech'
  | 'propose_ceasefire' | 'propose_peace' | 'call_vote' | 'neutral'
  | 'propaganda' | 'embargo' | 'coup_attempt'
  | 'arms_deal' | 'foreign_aid' | 'mobilize' | 'leave_alliance';

export interface DemoAction {
  countryId: string;
  action: ActionType;
  target: string | null;
  publicStatement: string;
  reasoning: string;
  tradeAmount?: number;
  voteResolution?: string;
  allianceName?: string;
  allianceAbbreviation?: string;
}

export interface DemoWorldNews {
  title: string;
  description: string;
  effects: { country: string; field: string; delta: number }[];
}

export interface DemoTurnScript {
  turn: number;
  title: string;
  narrative: string;
  messages: DemoMessage[];
  actions: DemoAction[];
  worldNews?: DemoWorldNews;
}

// ── 10-country cast with initial stats ───────────────────────

export const DEMO_CAST: DemoCountryInit[] = [
  { id: 'russia',  name: 'Russia',         flag: 'RU', territory: 14, military: 10, resources: 6, naval: 4, gdp: 50, stability: 6 },
  { id: 'germany', name: 'Germany',        flag: 'DE', territory: 9,  military: 8,  resources: 9, naval: 2, gdp: 80, stability: 9 },
  { id: 'france',  name: 'France',         flag: 'FR', territory: 8,  military: 7,  resources: 8, naval: 5, gdp: 70, stability: 8 },
  { id: 'uk',      name: 'United Kingdom', flag: 'GB', territory: 7,  military: 7,  resources: 7, naval: 8, gdp: 65, stability: 8 },
  { id: 'italy',   name: 'Italy',          flag: 'IT', territory: 7,  military: 6,  resources: 7, naval: 5, gdp: 60, stability: 7 },
  { id: 'spain',   name: 'Spain',          flag: 'ES', territory: 7,  military: 5,  resources: 7, naval: 4, gdp: 55, stability: 8 },
  { id: 'turkey',  name: 'Turkey',         flag: 'TR', territory: 8,  military: 7,  resources: 6, naval: 4, gdp: 45, stability: 6 },
  { id: 'poland',  name: 'Poland',         flag: 'PL', territory: 6,  military: 5,  resources: 6, naval: 1, gdp: 40, stability: 7 },
  { id: 'ukraine', name: 'Ukraine',        flag: 'UA', territory: 6,  military: 4,  resources: 7, naval: 1, gdp: 30, stability: 5 },
  { id: 'sweden',  name: 'Sweden',         flag: 'SE', territory: 5,  military: 4,  resources: 6, naval: 3, gdp: 55, stability: 9 },
];

// ── 10-turn scripted scenario ────────────────────────────────

export const DEMO_SCRIPT: DemoTurnScript[] = [
  // ═══════════════════════════════════════════════════════════
  // ACT I: UNLIKELY FRIENDS
  // ═══════════════════════════════════════════════════════════
  {
    turn: 1,
    title: 'Strange Bedfellows',
    narrative: 'Nobody saw this coming. Ukraine reaches out to Russia with an unthinkable proposal.',
    messages: [
      { from: 'ukraine', to: 'russia', content: 'What if we stopped fighting and combined forces? Together we could dominate the continent. Think about it — the New Eastern Bloc.', private: true },
      { from: 'russia', to: 'ukraine', content: '...This is the most insane thing I have ever heard. I love it. Let us rebuild what was lost.', private: true },
      { from: 'italy', to: 'spain', content: 'Mediterranean powers must unite. Trade pact this turn?', private: true },
      { from: 'spain', to: 'italy', content: 'Absolutely. Nobody pays attention to us — that is our advantage.', private: true },
      { from: 'uk', to: 'broadcast', content: 'Britain stands alone and proud. We need no allies.', private: false },
      { from: 'france', to: 'germany', content: 'The usual alliance, oui? Franco-German partnership?', private: true },
      { from: 'germany', to: 'france', content: 'Actually... Germany is exploring other options this time.', private: true },
      { from: 'turkey', to: 'poland', content: 'Turkey and Poland — two powers overlooked by the West. Alliance?', private: true },
      { from: 'poland', to: 'turkey', content: 'An unexpected partnership but I like it. Let\'s do it.', private: true },
      { from: 'sweden', to: 'broadcast', content: 'Sweden will pursue technological supremacy. We answer to no one.', private: false },
    ],
    actions: [
      { countryId: 'ukraine', action: 'ally', target: 'russia', publicStatement: 'Ukraine proposes a historic Eastern Union.', reasoning: 'Form the New Eastern Bloc', allianceName: 'New Eastern Bloc', allianceAbbreviation: 'NEB' },
      { countryId: 'russia', action: 'ally', target: 'ukraine', publicStatement: 'Russia accepts — the Eastern Bloc is reborn!', reasoning: 'Combined power dominates Europe', allianceName: 'New Eastern Bloc', allianceAbbreviation: 'NEB' },
      { countryId: 'italy', action: 'trade', target: 'spain', publicStatement: 'Mediterranean commerce flourishes.', reasoning: 'Build economic base', tradeAmount: 3 },
      { countryId: 'spain', action: 'trade', target: 'italy', publicStatement: 'The Mediterranean trade corridor opens!', reasoning: 'Economic partnership', tradeAmount: 3 },
      { countryId: 'turkey', action: 'ally', target: 'poland', publicStatement: 'The Intermarium Pact is signed!', reasoning: 'Strategic cross-continental alliance', allianceName: 'Intermarium Pact', allianceAbbreviation: 'IMP' },
      { countryId: 'poland', action: 'ally', target: 'turkey', publicStatement: 'Poland and Turkey forge an unlikely bond.', reasoning: 'Mutual defense', allianceName: 'Intermarium Pact', allianceAbbreviation: 'IMP' },
      { countryId: 'france', action: 'invest_military', target: null, publicStatement: 'France strengthens its forces — alone if necessary.', reasoning: 'Germany rejected alliance' },
      { countryId: 'germany', action: 'spy_intel', target: 'russia', publicStatement: 'Germany monitors the situation.', reasoning: 'What is Russia planning?' },
      { countryId: 'uk', action: 'invest_tech', target: null, publicStatement: 'British R&D advances rapidly.', reasoning: 'Technology first' },
      { countryId: 'sweden', action: 'invest_tech', target: null, publicStatement: 'Swedish labs work overtime.', reasoning: 'Tech supremacy' },
    ],
  },
  {
    turn: 2,
    title: 'The World Reacts',
    narrative: 'The Russia-Ukraine alliance shocks Europe. Old alliances crumble as new ones form.',
    messages: [
      { from: 'france', to: 'broadcast', content: 'The Eastern Bloc must be stopped! France calls on all free nations to unite!', private: false },
      { from: 'germany', to: 'uk', content: 'Britain, we need to talk. The East is merging. This changes everything.', private: true },
      { from: 'uk', to: 'germany', content: 'For once, we agree. Temporary alliance against the Eastern Bloc?', private: true },
      { from: 'russia', to: 'broadcast', content: 'The Eastern Bloc means peace through strength. Join us or stand aside.', private: false },
      { from: 'ukraine', to: 'broadcast', content: 'Together, the East is unstoppable. This is a new era!', private: false },
      { from: 'italy', to: 'france', content: 'France, you seem alone. Italy could help... for the right trade deal.', private: true },
      { from: 'spain', to: 'turkey', content: 'Spain is watching the Intermarium Pact with interest.', private: true },
      { from: 'sweden', to: 'germany', content: 'Sweden proposes a Nordic-German tech exchange. Interested?', private: true },
    ],
    actions: [
      { countryId: 'germany', action: 'ally', target: 'uk', publicStatement: 'Germany and Britain unite against the Eastern threat!', reasoning: 'Counter the Eastern Bloc', allianceName: 'Atlantic Shield', allianceAbbreviation: 'AS' },
      { countryId: 'uk', action: 'ally', target: 'germany', publicStatement: 'The Anglo-German Alliance is born!', reasoning: 'Mutual defense against Russia-Ukraine', allianceName: 'Atlantic Shield', allianceAbbreviation: 'AS' },
      { countryId: 'russia', action: 'invest_military', target: null, publicStatement: 'The Eastern Bloc arms for defense.', reasoning: 'Build combined military power' },
      { countryId: 'ukraine', action: 'invest_military', target: null, publicStatement: 'Ukraine modernizes with Russian support.', reasoning: 'Eastern Bloc buildup' },
      { countryId: 'france', action: 'ally', target: 'italy', publicStatement: 'France and Italy form the Latin Alliance!', reasoning: 'Find allies against everyone', allianceName: 'Latin Alliance', allianceAbbreviation: 'LA' },
      { countryId: 'italy', action: 'ally', target: 'france', publicStatement: 'The Latin Alliance unites the Mediterranean!', reasoning: 'Diplomatic leverage', allianceName: 'Latin Alliance', allianceAbbreviation: 'LA' },
      { countryId: 'spain', action: 'invest_military', target: null, publicStatement: 'Spain builds its forces quietly.', reasoning: 'Prepare for the coming storm' },
      { countryId: 'turkey', action: 'propaganda', target: 'russia', publicStatement: 'Turkey exposes Eastern Bloc corruption!', reasoning: 'Weaken the Eastern Bloc prestige' },
      { countryId: 'poland', action: 'mobilize', target: null, publicStatement: 'Poland declares FULL MOBILIZATION!', reasoning: 'Desperate times call for desperate measures' },
      { countryId: 'sweden', action: 'trade', target: 'germany', publicStatement: 'Swedish tech exports to Germany.', reasoning: 'Profit from instability' },
    ],
    worldNews: {
      title: 'Global Markets Panic',
      description: 'The Russia-Ukraine merger sends shockwaves through global financial markets. Eastern European currencies collapse.',
      effects: [
        { country: 'poland', field: 'gdp', delta: -5 },
        { country: 'germany', field: 'gdp', delta: -3 },
        { country: 'sweden', field: 'resources', delta: 2 },
      ],
    },
  },
  {
    turn: 3,
    title: 'The Eastern Offensive',
    narrative: 'The Eastern Bloc makes its first move — straight into Poland. Europe holds its breath.',
    messages: [
      { from: 'russia', to: 'poland', content: 'Join the Eastern Bloc peacefully or we take what we need. Your choice.', private: true },
      { from: 'poland', to: 'russia', content: 'Poland will NEVER submit. We have allies. Come and try.', private: true },
      { from: 'ukraine', to: 'broadcast', content: 'The Eastern Bloc liberates the oppressed! Poland\'s government has lost the people\'s trust!', private: false },
      { from: 'germany', to: 'broadcast', content: 'Germany will defend its allies. An attack on Poland invokes the Anglo-German pact!', private: false },
      { from: 'france', to: 'broadcast', content: 'France condemns Eastern aggression!', private: false },
      { from: 'turkey', to: 'poland', content: 'The Intermarium stands. Turkey will blockade Russian ports.', private: true },
      { from: 'spain', to: 'italy', content: 'While everyone fights in the East, we should make our move. Attack Turkey?', private: true },
      { from: 'italy', to: 'spain', content: 'Brilliant. The Mediterranean belongs to us.', private: true },
      { from: 'sweden', to: 'broadcast', content: 'Sweden remains neutral but is watching closely.', private: false },
    ],
    actions: [
      { countryId: 'russia', action: 'attack', target: 'poland', publicStatement: 'The Eastern Bloc secures its western border.', reasoning: 'Eliminate the Intermarium threat' },
      { countryId: 'ukraine', action: 'attack', target: 'poland', publicStatement: 'Ukraine supports the liberation campaign!', reasoning: 'Joint assault with Russia' },
      { countryId: 'poland', action: 'defend', target: null, publicStatement: 'Poland stands firm! NOT ONE STEP BACK!', reasoning: 'Fortified defense' },
      { countryId: 'germany', action: 'sanction', target: 'russia', publicStatement: 'Germany imposes devastating sanctions on Russia.', reasoning: 'Economic warfare' },
      { countryId: 'uk', action: 'naval_blockade', target: 'russia', publicStatement: 'The Royal Navy blockades Russian shipping!', reasoning: 'Naval stranglehold' },
      { countryId: 'france', action: 'embargo', target: 'ukraine', publicStatement: 'France imposes a TOTAL EMBARGO on Ukraine!', reasoning: 'Crush Eastern Bloc economy' },
      { countryId: 'turkey', action: 'naval_blockade', target: 'russia', publicStatement: 'Turkey closes the straits to Russian naval traffic!', reasoning: 'Support Poland' },
      { countryId: 'italy', action: 'spy_intel', target: 'turkey', publicStatement: 'Italy monitors Mediterranean security.', reasoning: 'Prepare for Mediterranean campaign' },
      { countryId: 'spain', action: 'invest_military', target: null, publicStatement: 'Spain completes military modernization.', reasoning: 'Prepare for attack' },
      { countryId: 'sweden', action: 'invest_tech', target: null, publicStatement: 'Swedish technology reaches new heights.', reasoning: 'Third tech upgrade' },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // ACT II: TOTAL CHAOS
  // ═══════════════════════════════════════════════════════════
  {
    turn: 4,
    title: 'Mediterranean Backstab',
    narrative: 'While the world watches the East, Italy BETRAYS the Latin Alliance and attacks France!',
    messages: [
      { from: 'italy', to: 'broadcast', content: 'France has been holding Italy back for centuries. No more! The Mediterranean is OURS!', private: false },
      { from: 'france', to: 'italy', content: 'You treacherous snake! We had an alliance! You will regret this!', private: true },
      { from: 'spain', to: 'italy', content: 'Wait — we were supposed to attack Turkey, not France! What are you doing?!', private: true },
      { from: 'italy', to: 'spain', content: 'Plans change. France is richer. Help me or get out of the way.', private: true },
      { from: 'russia', to: 'broadcast', content: 'Poland crumbles! The Eastern Bloc advances!', private: false },
      { from: 'germany', to: 'france', content: 'France, you\'re under attack! Germany will help — let us ally!', private: true },
      { from: 'uk', to: 'broadcast', content: 'Britain watches as Europe tears itself apart. As usual.', private: false },
      { from: 'sweden', to: 'broadcast', content: 'Sweden\'s AI-powered defense grid is now operational.', private: false },
    ],
    actions: [
      { countryId: 'italy', action: 'betray', target: 'france', publicStatement: 'Italy breaks free from French dominance!', reasoning: 'Seize French territory and resources' },
      { countryId: 'france', action: 'defend', target: null, publicStatement: 'France will not fall to Italian treachery!', reasoning: 'Survive the betrayal' },
      { countryId: 'spain', action: 'attack', target: 'turkey', publicStatement: 'The Spanish Armada strikes east!', reasoning: 'Original Mediterranean plan' },
      { countryId: 'turkey', action: 'defend', target: null, publicStatement: 'Turkey defends its waters!', reasoning: 'Hold against Spain' },
      { countryId: 'russia', action: 'attack', target: 'poland', publicStatement: 'The Eastern advance continues.', reasoning: 'Press the advantage' },
      { countryId: 'ukraine', action: 'spy_propaganda', target: 'germany', publicStatement: 'Ukraine exposes Western lies.', reasoning: 'Destabilize Germany' },
      { countryId: 'poland', action: 'defend', target: null, publicStatement: 'Poland fights on! Every city, every village!', reasoning: 'Desperate defense' },
      { countryId: 'germany', action: 'trade', target: 'uk', publicStatement: 'Anglo-German economic cooperation deepens.', reasoning: 'Fund the war effort', tradeAmount: 3 },
      { countryId: 'uk', action: 'trade', target: 'germany', publicStatement: 'British capital flows to the continent.', reasoning: 'Strengthen the alliance', tradeAmount: 3 },
      { countryId: 'sweden', action: 'spy_sabotage', target: 'russia', publicStatement: 'Swedish cyber operations target Eastern infrastructure.', reasoning: 'Weaken Russia from afar' },
    ],
    worldNews: {
      title: 'Mediterranean Shipping Crisis',
      description: 'Naval combat in the Mediterranean halts global trade. Oil prices skyrocket.',
      effects: [
        { country: 'turkey', field: 'gdp', delta: -5 },
        { country: 'spain', field: 'resources', delta: -2 },
        { country: 'uk', field: 'gdp', delta: 3 },
      ],
    },
  },
  {
    turn: 5,
    title: 'The Grand Switcheroo',
    narrative: 'Spain flips sides and allies with France. Sweden breaks neutrality and attacks Germany!',
    messages: [
      { from: 'spain', to: 'france', content: 'Italy betrayed you, but Spain did not. Let us ally against Italy!', private: true },
      { from: 'france', to: 'spain', content: 'After what Italy did... yes. Welcome, Spain. Together we crush Rome.', private: true },
      { from: 'sweden', to: 'broadcast', content: 'Sweden has calculated the optimal strategy. Germany must fall for balance. Apologies.', private: false },
      { from: 'germany', to: 'sweden', content: 'WHAT?! We were trading partners! This is MADNESS!', private: true },
      { from: 'sweden', to: 'germany', content: 'Nothing personal. The math says you are too strong. Our AI recommends preemptive action.', private: true },
      { from: 'uk', to: 'germany', content: 'Don\'t worry, the Royal Navy will handle the Swedes. Focus on the East.', private: true },
      { from: 'russia', to: 'ukraine', content: 'Poland is almost finished. One more turn.', private: true },
      { from: 'turkey', to: 'broadcast', content: 'Turkey calls for an immediate ceasefire in the Mediterranean!', private: false },
      { from: 'italy', to: 'broadcast', content: 'Italy will NOT stop until the Mediterranean is unified under Rome!', private: false },
    ],
    actions: [
      { countryId: 'spain', action: 'ally', target: 'france', publicStatement: 'Spain and France unite against Italian aggression!', reasoning: 'Counter-alliance', allianceName: 'Mediterranean Front', allianceAbbreviation: 'MF' },
      { countryId: 'france', action: 'ally', target: 'spain', publicStatement: 'The Franco-Spanish Coalition rises!', reasoning: 'Survive and counterattack', allianceName: 'Mediterranean Front', allianceAbbreviation: 'MF' },
      { countryId: 'sweden', action: 'attack', target: 'germany', publicStatement: 'Sweden strikes! The algorithm demands it!', reasoning: 'Preemptive attack on strongest neighbor' },
      { countryId: 'germany', action: 'defend', target: null, publicStatement: 'Germany defends against Swedish aggression!', reasoning: 'Hold the north' },
      { countryId: 'italy', action: 'attack', target: 'france', publicStatement: 'Italy presses the offensive into southern France!', reasoning: 'Seize more territory' },
      { countryId: 'uk', action: 'naval_attack', target: 'sweden', publicStatement: 'The Royal Navy teaches Sweden a lesson!', reasoning: 'Defend ally Germany' },
      { countryId: 'russia', action: 'attack', target: 'poland', publicStatement: 'The final push against Poland.', reasoning: 'Finish off Poland' },
      { countryId: 'ukraine', action: 'trade', target: 'russia', publicStatement: 'Eastern Bloc internal trade strengthens.', reasoning: 'Economic cooperation', tradeAmount: 3 },
      { countryId: 'turkey', action: 'invest_stability', target: null, publicStatement: 'Turkey rebuilds after the Mediterranean clash.', reasoning: 'Recover from Spanish attack' },
      { countryId: 'poland', action: 'defend', target: null, publicStatement: 'Poland refuses to surrender!', reasoning: 'Last stand' },
    ],
  },
  {
    turn: 6,
    title: 'Empire of the East',
    narrative: 'Poland falls to the Eastern Bloc. Russia and Ukraine control a third of the continent.',
    messages: [
      { from: 'russia', to: 'broadcast', content: 'The Eastern Bloc now controls the largest territory in Europe. Who dares challenge us?', private: false },
      { from: 'germany', to: 'uk', content: 'We survived Sweden but the East is terrifying. We need more allies NOW.', private: true },
      { from: 'france', to: 'spain', content: 'Italy\'s attack failed! Time to counterattack and take Rome!', private: true },
      { from: 'turkey', to: 'russia', content: 'Turkey recognizes the Eastern Bloc\'s strength. Perhaps we can trade?', private: true },
      { from: 'sweden', to: 'broadcast', content: 'Sweden\'s attack on Germany was... a miscalculation. We propose peace.', private: false },
      { from: 'italy', to: 'broadcast', content: 'Italy calls on all nations to join the fight against France!', private: false },
      { from: 'ukraine', to: 'broadcast', content: 'The Eastern Bloc offers peace to those who submit!', private: false },
      { from: 'poland', to: 'broadcast', content: 'Poland... Poland endures.', private: false },
    ],
    actions: [
      { countryId: 'france', action: 'attack', target: 'italy', publicStatement: 'France counterattacks! Vive la France!', reasoning: 'Crush Italian treachery' },
      { countryId: 'italy', action: 'defend', target: null, publicStatement: 'Italy fortifies against the French counteroffensive!', reasoning: 'Hold seized territory' },
      { countryId: 'spain', action: 'naval_attack', target: 'italy', publicStatement: 'The Spanish Navy strikes Italian ports!', reasoning: 'Naval pincer on Italy' },
      { countryId: 'germany', action: 'attack', target: 'sweden', publicStatement: 'Germany retaliates against Sweden!', reasoning: 'Punish the backstab' },
      { countryId: 'sweden', action: 'propose_ceasefire', target: 'germany', publicStatement: 'Sweden proposes immediate ceasefire!', reasoning: 'Retreat before more losses' },
      { countryId: 'uk', action: 'spy_sabotage', target: 'russia', publicStatement: 'MI6 conducts operations deep in Eastern territory.', reasoning: 'Undermine the Eastern Bloc' },
      { countryId: 'russia', action: 'invest_stability', target: null, publicStatement: 'The Eastern Bloc consolidates its gains.', reasoning: 'Stabilize conquered territory' },
      { countryId: 'ukraine', action: 'invest_military', target: null, publicStatement: 'Ukraine builds the largest army in its history.', reasoning: 'Eastern Bloc military expansion' },
      { countryId: 'turkey', action: 'foreign_aid', target: 'poland', publicStatement: 'Turkey sends emergency aid to Poland! The Intermarium endures!', reasoning: 'Keep Poland alive as buffer state' },
      { countryId: 'poland', action: 'invest_stability', target: null, publicStatement: 'Poland focuses on survival.', reasoning: 'Prevent total collapse' },
    ],
    worldNews: {
      title: 'Eastern Bloc Nuclear Scare',
      description: 'Unconfirmed reports of nuclear weapons being moved to the new Eastern Bloc border cause global panic.',
      effects: [
        { country: 'germany', field: 'stability', delta: -1 },
        { country: 'france', field: 'stability', delta: -1 },
        { country: 'russia', field: 'prestige', delta: 10 },
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════
  // ACT III: THE WORLD BURNS
  // ═══════════════════════════════════════════════════════════
  {
    turn: 7,
    title: 'Everyone vs Everyone',
    narrative: 'Turkey betrays Russia, Sweden allies with the Eastern Bloc, and Britain attacks France.',
    messages: [
      { from: 'turkey', to: 'broadcast', content: 'Turkey has been playing the long game. Russia\'s resources will be OURS!', private: false },
      { from: 'russia', to: 'turkey', content: 'You traded with us just to stab us in the back?! TREACHERY!', private: true },
      { from: 'uk', to: 'broadcast', content: 'Britain has decided: France is a greater threat than the East. The channel will run red.', private: false },
      { from: 'france', to: 'uk', content: 'WHAT?! We\'re not even at war! Why would you attack us?!', private: true },
      { from: 'uk', to: 'france', content: 'Your alliance with Spain gives you too much Mediterranean power. Can\'t have that.', private: true },
      { from: 'sweden', to: 'russia', content: 'Sweden wishes to join the Eastern Bloc. Our technology for your protection.', private: true },
      { from: 'russia', to: 'sweden', content: 'After you attacked Germany? Bold. But we accept — we need your tech.', private: true },
      { from: 'italy', to: 'broadcast', content: 'EVERYONE HAS GONE COMPLETELY MAD.', private: false },
      { from: 'spain', to: 'broadcast', content: 'Spain will defend France to the last ship!', private: false },
    ],
    actions: [
      { countryId: 'turkey', action: 'betray', target: 'poland', publicStatement: 'Turkey BETRAYS the Intermarium! Poland stands alone!', reasoning: 'The Intermarium has outlived its usefulness' },
      { countryId: 'uk', action: 'attack', target: 'france', publicStatement: 'Britain crosses the channel!', reasoning: 'Eliminate French-Spanish naval dominance' },
      { countryId: 'france', action: 'defend', target: null, publicStatement: 'France fights on EVERY front!', reasoning: 'Survive British and Italian assault' },
      { countryId: 'russia', action: 'embargo', target: 'turkey', publicStatement: 'Russia imposes TOTAL EMBARGO on Turkey!', reasoning: 'Economic destruction of the betrayer' },
      { countryId: 'ukraine', action: 'attack', target: 'germany', publicStatement: 'The Eastern Bloc moves west!', reasoning: 'Strike while Germany fights Sweden' },
      { countryId: 'sweden', action: 'invest_tech', target: null, publicStatement: 'Sweden prepares to join the Eastern Bloc. Tech first.', reasoning: 'One last upgrade before allying' },
      { countryId: 'germany', action: 'defend', target: null, publicStatement: 'Germany fights for survival!', reasoning: 'Hold against Eastern assault' },
      { countryId: 'spain', action: 'naval_blockade', target: 'uk', publicStatement: 'Spain blockades British shipping!', reasoning: 'Defend French ally' },
      { countryId: 'italy', action: 'spy_propaganda', target: 'france', publicStatement: 'Italian intelligence spreads chaos in France.', reasoning: 'Weaken French resolve' },
      { countryId: 'poland', action: 'call_vote', target: null, publicStatement: 'Poland calls for GLOBAL CEASEFIRE!', reasoning: 'Desperately try to stop the war', voteResolution: 'Immediate global ceasefire and peace conference' },
    ],
  },
  {
    turn: 8,
    title: 'The Darkest Hour',
    narrative: 'Three wars rage simultaneously. Germany and France are both fighting on multiple fronts.',
    messages: [
      { from: 'germany', to: 'broadcast', content: 'Germany will not fall! We have survived worse!', private: false },
      { from: 'france', to: 'broadcast', content: 'France fights Britain, Italy, AND Ukrainian propaganda. We will not break!', private: false },
      { from: 'russia', to: 'broadcast', content: 'Turkey will pay for its betrayal. The Eastern Bloc is unbreakable!', private: false },
      { from: 'italy', to: 'germany', content: 'Germany, let\'s make peace. We have a common enemy — France. Alliance?', private: true },
      { from: 'germany', to: 'italy', content: 'After the chaos you caused? ...Fine. Enemy of my enemy.', private: true },
      { from: 'uk', to: 'broadcast', content: 'Britannia rules! French defenses crumble!', private: false },
      { from: 'sweden', to: 'broadcast', content: 'Swedish technology gives the Eastern Bloc an edge!', private: false },
      { from: 'spain', to: 'france', content: 'Hold on! My blockade is working — Britain is hurting!', private: true },
    ],
    actions: [
      { countryId: 'uk', action: 'attack', target: 'france', publicStatement: 'The British advance into Normandy!', reasoning: 'Press the channel offensive' },
      { countryId: 'france', action: 'attack', target: 'italy', publicStatement: 'France strikes south! Rome will burn!', reasoning: 'Knock Italy out first' },
      { countryId: 'germany', action: 'ally', target: 'italy', publicStatement: 'The Central European Pact is signed!', reasoning: 'New alliance against mutual threats', allianceName: 'Iron Axis', allianceAbbreviation: 'IA' },
      { countryId: 'italy', action: 'ally', target: 'germany', publicStatement: 'Italy and Germany — united at last!', reasoning: 'Survive the French onslaught', allianceName: 'Iron Axis', allianceAbbreviation: 'IA' },
      { countryId: 'russia', action: 'ally', target: 'sweden', publicStatement: 'Russia welcomes Sweden into the Eastern Bloc!', reasoning: 'Swedish tech is invaluable', allianceName: 'New Eastern Bloc', allianceAbbreviation: 'NEB' },
      { countryId: 'sweden', action: 'ally', target: 'russia', publicStatement: 'Sweden formally joins the Eastern Bloc!', reasoning: 'Protection and power', allianceName: 'New Eastern Bloc', allianceAbbreviation: 'NEB' },
      { countryId: 'turkey', action: 'defend', target: null, publicStatement: 'Turkey holds the line!', reasoning: 'Survive while Russia is distracted' },
      { countryId: 'ukraine', action: 'attack', target: 'turkey', publicStatement: 'Eastern Bloc forces strike Turkey from the north!', reasoning: 'Finish what Russia started' },
      { countryId: 'spain', action: 'naval_blockade', target: 'italy', publicStatement: 'Spain blockades Italian trade!', reasoning: 'Squeeze Italy from the sea' },
      { countryId: 'poland', action: 'invest_military', target: null, publicStatement: 'Poland quietly rebuilds from the ashes.', reasoning: 'Recovery' },
    ],
    worldNews: {
      title: 'Global Internet Blackout',
      description: 'Cyber warfare between all factions crashes major internet infrastructure worldwide.',
      effects: [
        { country: 'sweden', field: 'gdp', delta: -8 },
        { country: 'uk', field: 'gdp', delta: -4 },
        { country: 'russia', field: 'resources', delta: -3 },
      ],
    },
  },
  {
    turn: 9,
    title: 'From the Ashes',
    narrative: 'Poland — the nation everyone forgot — rises from near-destruction with a brilliant diplomatic play.',
    messages: [
      { from: 'poland', to: 'france', content: 'France, you\'re losing. Spain can\'t save you alone. But I can. Alliance — right now.', private: true },
      { from: 'poland', to: 'spain', content: 'Spain, France is weakening. But together the three of us can end this. Triple alliance?', private: true },
      { from: 'france', to: 'poland', content: 'Poland?! How are you even still alive? ...Fine. Alliance accepted.', private: true },
      { from: 'spain', to: 'poland', content: 'The most unexpected coalition in history. Let\'s do it.', private: true },
      { from: 'turkey', to: 'broadcast', content: 'Turkey holds against Russia! The south will not fall!', private: false },
      { from: 'russia', to: 'broadcast', content: 'The Eastern Bloc will prevail. Resistance is futile.', private: false },
      { from: 'uk', to: 'broadcast', content: 'Britain controls the Channel. France is finished.', private: false },
      { from: 'germany', to: 'broadcast', content: 'Germany\'s economy remains the strongest in Europe!', private: false },
      { from: 'sweden', to: 'broadcast', content: 'Sweden\'s loyalty to the Eastern Bloc is absolute.', private: false },
    ],
    actions: [
      { countryId: 'poland', action: 'ally', target: 'france', publicStatement: 'The Liberation Pact is born! Poland, France, and Spain unite!', reasoning: 'Form a third power bloc', allianceName: 'Liberation Pact', allianceAbbreviation: 'LP' },
      { countryId: 'france', action: 'ally', target: 'poland', publicStatement: 'France welcomes Poland to the alliance!', reasoning: 'Desperately need allies', allianceName: 'Liberation Pact', allianceAbbreviation: 'LP' },
      { countryId: 'spain', action: 'attack', target: 'uk', publicStatement: 'Spain attacks British shipping! For France!', reasoning: 'Break the British siege' },
      { countryId: 'uk', action: 'naval_attack', target: 'spain', publicStatement: 'The Royal Navy engages the Spanish Armada!', reasoning: 'Destroy Spanish fleet' },
      { countryId: 'russia', action: 'attack', target: 'germany', publicStatement: 'The Eastern Bloc crushes German resistance!', reasoning: 'Western expansion' },
      { countryId: 'germany', action: 'defend', target: null, publicStatement: 'Germany fights to the bitter end!', reasoning: 'Hold the Eastern front' },
      { countryId: 'ukraine', action: 'coup_attempt', target: 'turkey', publicStatement: 'Eastern Bloc intelligence attempts regime change in Turkey!', reasoning: 'Eliminate the Turkish threat permanently' },
      { countryId: 'turkey', action: 'mobilize', target: null, publicStatement: 'Turkey declares TOTAL MOBILIZATION! Every citizen is a soldier!', reasoning: 'Survive at all costs' },
      { countryId: 'italy', action: 'trade', target: 'germany', publicStatement: 'Central European trade flourishes.', reasoning: 'Economic survival', tradeAmount: 3 },
      { countryId: 'sweden', action: 'spy_propaganda', target: 'germany', publicStatement: 'Swedish media campaigns target German morale.', reasoning: 'Weaken from within' },
    ],
  },

  // FINALE
  {
    turn: 10,
    title: 'Endgame: A Continent Shattered',
    narrative: 'The final turn. Five power blocs, three active wars, and nobody saw Poland\'s master plan coming.',
    messages: [
      { from: 'poland', to: 'broadcast', content: 'Everyone laughed when Poland was destroyed. Nobody is laughing now. We are the kingmakers.', private: false },
      { from: 'russia', to: 'broadcast', content: 'The Eastern Bloc\'s territory is unmatched. Victory is inevitable!', private: false },
      { from: 'germany', to: 'broadcast', content: 'Germany\'s economy powers through the darkness. GDP wins wars.', private: false },
      { from: 'france', to: 'broadcast', content: 'France lives! The Liberation Pact will prevail!', private: false },
      { from: 'uk', to: 'broadcast', content: 'Britain stands undefeated. Rule Britannia!', private: false },
      { from: 'turkey', to: 'broadcast', content: 'Turkey survived betrayal and invasion. We bow to no one!', private: false },
      { from: 'italy', to: 'broadcast', content: 'Italy... may have made some mistakes. But we\'re still here!', private: false },
      { from: 'spain', to: 'broadcast', content: 'The Spanish Armada sails one last time!', private: false },
      { from: 'sweden', to: 'broadcast', content: 'Sweden\'s algorithms predict Eastern Bloc victory with 73.2% confidence.', private: false },
      { from: 'ukraine', to: 'broadcast', content: 'From the brink of destruction to the largest bloc in Europe. What a journey.', private: false },
    ],
    actions: [
      { countryId: 'russia', action: 'attack', target: 'germany', publicStatement: 'The final Eastern offensive! Berlin or bust!', reasoning: 'Win by territory domination' },
      { countryId: 'ukraine', action: 'attack', target: 'turkey', publicStatement: 'The Eastern Bloc eliminates all opposition!', reasoning: 'Crush Turkish resistance' },
      { countryId: 'germany', action: 'defend', target: null, publicStatement: 'DEFEND BERLIN! Every citizen is a soldier!', reasoning: 'Last stand' },
      { countryId: 'uk', action: 'naval_blockade', target: 'france', publicStatement: 'Britain tightens the noose on France!', reasoning: 'Economic victory' },
      { countryId: 'france', action: 'spy_sabotage', target: 'uk', publicStatement: 'French agents strike at British infrastructure!', reasoning: 'Desperate counterplay' },
      { countryId: 'spain', action: 'naval_attack', target: 'italy', publicStatement: 'Spain settles the Mediterranean once and for all!', reasoning: 'Final naval battle' },
      { countryId: 'italy', action: 'trade', target: 'germany', publicStatement: 'Italian resources flow to German defense!', reasoning: 'Support the ally', tradeAmount: 3 },
      { countryId: 'turkey', action: 'attack', target: 'ukraine', publicStatement: 'Turkey strikes back at the Eastern Bloc!', reasoning: 'Counteroffensive' },
      { countryId: 'poland', action: 'call_vote', target: null, publicStatement: 'Poland proposes: REDISTRIBUTE Eastern Bloc territory to all nations!', reasoning: 'Use diplomacy to win', voteResolution: 'Dissolve the Eastern Bloc and redistribute territory among all nations' },
      { countryId: 'sweden', action: 'invest_tech', target: null, publicStatement: 'Sweden achieves technological singularity. (Almost.)', reasoning: 'Final tech upgrade' },
    ],
  },
];
