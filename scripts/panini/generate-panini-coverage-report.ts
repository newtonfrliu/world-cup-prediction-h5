import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type SquadPlayer = {
  country: string;
  shirt_number: number;
  position: string;
  player_name: string;
  player_name_en: string;
  first_name?: string;
  last_name?: string;
  name_on_shirt?: string;
};

type SquadCountry = {
  country: string;
  players: SquadPlayer[];
};

type SquadFile = {
  countries: SquadCountry[];
};

type CoreCardsConfig = Record<string, string[]>;

type ReportPlayer = {
  player_name: string;
  player_name_en: string;
  shirt_number: number;
  position: string;
};

type CountryReport = {
  country: string;
  total_players: number;
  core_cards: number;
  panini_cards: number;
  missing: string[];
  core_players: ReportPlayer[];
  panini_players: ReportPlayer[];
};

const root = process.cwd();
const squadPath = path.join(root, "data", "fifa-2026-squads.json");
const coreCardsPath = path.join(root, "data", "core-cards.json");
const reportPath = path.join(root, "data", "panini-coverage-report.json");

function normalizeName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCaseName(name: string) {
  return name
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function officialNameCandidates(player: SquadPlayer) {
  const values = new Set<string>();
  const add = (value?: string) => {
    if (value?.trim()) {
      values.add(normalizeName(value));
    }
  };

  add(player.player_name);
  add(player.player_name_en);
  add(player.name_on_shirt);
  add(player.first_name);
  add(player.last_name);

  if (player.first_name && player.last_name) {
    add(`${player.first_name} ${player.last_name}`);
    add(`${player.last_name} ${player.first_name}`);
  }

  const englishParts = player.player_name_en.trim().split(/\s+/);
  const firstMixedIndex = englishParts.findIndex((part) => part !== part.toUpperCase());

  if (firstMixedIndex > 0) {
    const lastName = englishParts.slice(0, firstMixedIndex).join(" ");
    const givenName = englishParts.slice(firstMixedIndex).join(" ");
    add(`${givenName} ${lastName}`);
    add(`${lastName} ${givenName}`);
  }

  if (player.player_name_en === player.player_name_en.toUpperCase()) {
    add(titleCaseName(player.player_name_en));
  }

  return values;
}

function toReportPlayer(player: SquadPlayer): ReportPlayer {
  return {
    player_name: player.player_name,
    player_name_en: player.player_name_en,
    shirt_number: player.shirt_number,
    position: player.position,
  };
}

function buildCountryReport(country: string, players: SquadPlayer[], coreNames: string[]): CountryReport {
  const coreLookup = new Map<string, string>();
  const matchedCoreNames = new Set<string>();
  const corePlayerKeys = new Set<string>();

  for (const coreName of coreNames) {
    coreLookup.set(normalizeName(coreName), coreName);
  }

  for (const player of players) {
    const candidates = officialNameCandidates(player);

    for (const candidate of candidates) {
      const coreName = coreLookup.get(candidate);

      if (coreName) {
        matchedCoreNames.add(coreName);
        corePlayerKeys.add(`${player.country}:${player.shirt_number}`);
      }
    }
  }

  const corePlayers = players.filter((player) => corePlayerKeys.has(`${player.country}:${player.shirt_number}`));
  const paniniPlayers = players.filter((player) => !corePlayerKeys.has(`${player.country}:${player.shirt_number}`));
  const missing = coreNames.filter((coreName) => !matchedCoreNames.has(coreName));

  return {
    country,
    total_players: players.length,
    core_cards: corePlayers.length,
    panini_cards: paniniPlayers.length,
    missing,
    core_players: corePlayers.map(toReportPlayer),
    panini_players: paniniPlayers.map(toReportPlayer),
  };
}

function main() {
  const squadFile = JSON.parse(readFileSync(squadPath, "utf8")) as SquadFile;
  const coreCards = JSON.parse(readFileSync(coreCardsPath, "utf8")) as CoreCardsConfig;
  const reports: CountryReport[] = [];

  for (const [country, coreNames] of Object.entries(coreCards)) {
    const countrySquad = squadFile.countries.find((entry) => entry.country === country);

    if (!countrySquad) {
      reports.push({
        country,
        total_players: 0,
        core_cards: 0,
        panini_cards: 0,
        missing: coreNames,
        core_players: [],
        panini_players: [],
      });
      continue;
    }

    reports.push(buildCountryReport(country, countrySquad.players, coreNames));
  }

  const totals = reports.reduce(
    (sum, report) => ({
      countries: sum.countries + 1,
      total_players: sum.total_players + report.total_players,
      core_cards: sum.core_cards + report.core_cards,
      panini_cards: sum.panini_cards + report.panini_cards,
      missing: sum.missing + report.missing.length,
    }),
    { countries: 0, total_players: 0, core_cards: 0, panini_cards: 0, missing: 0 },
  );

  const report = {
    generated_at: new Date().toISOString(),
    source: {
      squad_file: "data/fifa-2026-squads.json",
      core_cards_file: "data/core-cards.json",
      output_rule: "core_cards.json players are skipped permanently; all other players require Panini completion cards.",
    },
    totals,
    countries: reports,
  };

  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`Countries: ${totals.countries}`);
  console.log(`Total players: ${totals.total_players}`);
  console.log(`Core cards: ${totals.core_cards}`);
  console.log(`Need Panini cards: ${totals.panini_cards}`);
  console.log(`Missing core mappings: ${totals.missing}`);
  console.log(`Report written: ${path.relative(root, reportPath)}`);
}

main();
