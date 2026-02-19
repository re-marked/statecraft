// ============================================================
// STATECRAFT v3 — Economy System
// Income (claim_income), maintenance, trade, sanctions
// ============================================================

import type { Country, Province, Resolution, SubmittedAction } from "../../types/index.js";
import { calculateIncome, calculateMaintenance, calculateDesertions, calculateTradeValue } from "../formulas/economy-math.js";
import { GAME_CONFIG } from "../config.js";

interface EconomyAction {
  countryId: string;
  displayName: string;
  action: SubmittedAction;
}

interface EconomyContext {
  countries: Country[];
  provincesByCountry: Map<string, Province[]>;
  actions: EconomyAction[];
  claimIncomeCountries: Set<string>;  // countries that submitted claim_income
  sanctionCounts: Map<string, number>;
  embargoCounts: Map<string, number>;
}

export interface EconomyResults {
  resolutions: Resolution[];
  moneyChanges: Map<string, number>;
  troopDesertions: Map<string, number>;
  trades: { from: string; to: string; fromAmount: number; toAmount: number }[];
}

export function processEconomy(ctx: EconomyContext): EconomyResults {
  const resolutions: Resolution[] = [];
  const moneyChanges = new Map<string, number>();
  const troopDesertions = new Map<string, number>();
  const trades: EconomyResults["trades"] = [];

  function addMoney(countryId: string, delta: number) {
    moneyChanges.set(countryId, (moneyChanges.get(countryId) ?? 0) + delta);
  }

  // 1. Income for countries that claimed it
  for (const country of ctx.countries) {
    if (country.isEliminated) continue;

    if (ctx.claimIncomeCountries.has(country.countryId)) {
      const provinces = ctx.provincesByCountry.get(country.countryId) ?? [];
      const totalGdp = provinces.reduce((sum, p) => sum + p.gdpValue, 0);
      const sanctionCount = ctx.sanctionCounts.get(country.countryId) ?? 0;
      const embargoCount = ctx.embargoCounts.get(country.countryId) ?? 0;
      const income = calculateIncome(totalGdp, country.tech, sanctionCount, embargoCount);

      addMoney(country.countryId, income);
      resolutions.push({
        type: "claim_income",
        countries: [country.countryId],
        description: `${country.displayName} collects ${income}M in tax revenue.`,
        stateChanges: [{ country: country.countryId, field: "money", delta: income }],
      });
    }

    // 2. Maintenance (automatic)
    const maintenance = calculateMaintenance(country.totalTroops, country.tech);
    addMoney(country.countryId, -maintenance);

    // 3. Check for desertions if broke
    const projectedMoney = country.money + (moneyChanges.get(country.countryId) ?? 0);
    if (projectedMoney < 0) {
      const desertions = calculateDesertions(country.totalTroops, projectedMoney, maintenance);
      if (desertions > 0) {
        troopDesertions.set(country.countryId, desertions);
        resolutions.push({
          type: "troop_desertion",
          countries: [country.countryId],
          description: `${country.displayName} can't pay its army! ${desertions}K troops desert!`,
          stateChanges: [{ country: country.countryId, field: "totalTroops", delta: -desertions }],
        });
      }
    }
  }

  // 4. Mutual trades
  const tradeActions = ctx.actions.filter((a) => a.action.action === "trade");
  const processedTrades = new Set<string>();

  for (const a of tradeActions) {
    if (!a.action.target || !a.action.amount) continue;
    const key = [a.countryId, a.action.target].sort().join("|");
    if (processedTrades.has(key)) continue;

    const mutual = tradeActions.find(
      (b) => b.countryId === a.action.target && b.action.target === a.countryId
    );

    if (mutual && mutual.action.amount) {
      processedTrades.add(key);
      const value = calculateTradeValue(a.action.amount, mutual.action.amount);

      addMoney(a.countryId, value);
      addMoney(a.action.target, value);

      trades.push({
        from: a.countryId,
        to: a.action.target,
        fromAmount: a.action.amount,
        toAmount: mutual.action.amount,
      });

      const targetName = ctx.countries.find((c) => c.countryId === a.action.target)?.displayName ?? a.action.target;
      resolutions.push({
        type: "trade_success",
        countries: [a.countryId, a.action.target],
        description: `${a.displayName} and ${targetName} complete a trade deal (+${value}M each).`,
        stateChanges: [
          { country: a.countryId, field: "money", delta: value },
          { country: a.action.target, field: "money", delta: value },
        ],
      });
    } else {
      resolutions.push({
        type: "trade_failed",
        countries: [a.countryId],
        description: `${a.displayName}'s trade offer was not reciprocated.`,
        stateChanges: [],
      });
    }
  }

  // 5. Sanctions
  for (const a of ctx.actions.filter((x) => x.action.action === "sanction")) {
    if (!a.action.target) continue;
    const targetName = ctx.countries.find((c) => c.countryId === a.action.target)?.displayName ?? a.action.target;
    resolutions.push({
      type: "sanction_applied",
      countries: [a.countryId, a.action.target],
      description: `${a.displayName} sanctions ${targetName}!`,
      stateChanges: [],
    });
  }

  // 6. Embargoes
  for (const a of ctx.actions.filter((x) => x.action.action === "embargo")) {
    if (!a.action.target) continue;
    const targetName = ctx.countries.find((c) => c.countryId === a.action.target)?.displayName ?? a.action.target;
    addMoney(a.countryId, -10); // self-cost
    resolutions.push({
      type: "embargo_applied",
      countries: [a.countryId, a.action.target],
      description: `${a.displayName} embargoes ${targetName}!`,
      stateChanges: [{ country: a.countryId, field: "money", delta: -10 }],
    });
  }

  return { resolutions, moneyChanges, troopDesertions, trades };
}
