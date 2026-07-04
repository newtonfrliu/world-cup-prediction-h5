import { KnockoutBracketClient } from "@/app/knockout-bracket/KnockoutBracketClient";
import { fetchKnockoutMatches } from "@/lib/knockout-bracket";

export const dynamic = "force-dynamic";

export default async function KnockoutBracketPage() {
  const matches = await fetchKnockoutMatches();

  return <KnockoutBracketClient matches={matches} />;
}
