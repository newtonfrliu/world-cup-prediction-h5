import {
  countriesByNameEn,
  getCountryDisplayName,
  worldCupCountryNames,
} from "@/lib/countries";

export const teamMeta = Object.fromEntries(
  Object.entries(countriesByNameEn).map(([team, country]) => [
    team,
    {
      cn: country.nameZh,
      flag: country.flag,
    },
  ]),
) satisfies Record<string, { cn: string; flag: string }>;

export function getTeamDisplayName(team: string): string {
  return getCountryDisplayName(team);
}

export const worldCupTeams = worldCupCountryNames;
