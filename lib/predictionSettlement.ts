export type PredictionChoice = string | null | undefined;
export type MatchResultValue = string | null | undefined;

export function normalizePredictionChoice(prediction: PredictionChoice) {
  const normalized = (prediction ?? "").trim().toLowerCase();

  if (normalized === "home_win" || normalized === "home") return "home";
  if (normalized === "away_win" || normalized === "away") return "away";
  if (normalized === "draw") return "draw";
  return normalized;
}

export function normalizeMatchResult(result: MatchResultValue) {
  const normalized = (result ?? "").trim().toLowerCase();

  if (normalized === "home_win" || normalized === "home") return "home";
  if (normalized === "away_win" || normalized === "away") return "away";
  if (normalized === "draw") return "draw";
  return normalized;
}

export function isPredictionHit(
  prediction: PredictionChoice,
  result: MatchResultValue,
) {
  const normalizedPrediction = normalizePredictionChoice(prediction);
  const normalizedResult = normalizeMatchResult(result);

  return Boolean(normalizedPrediction) && normalizedPrediction === normalizedResult;
}

export function getPredictionSettlementStatus(
  prediction: PredictionChoice,
  result: MatchResultValue,
) {
  return isPredictionHit(prediction, result) ? "won" : "lost";
}

export function calculateSettlementPoints(
  oddsAtPrediction: number | null | undefined,
  isHit: boolean,
) {
  return isHit ? Math.round((oddsAtPrediction ?? 0) * 100) : 0;
}

export function calculateSettlementPayout(
  stake: number | null | undefined,
  oddsAtPrediction: number | null | undefined,
  isHit: boolean,
) {
  return isHit ? Math.round((stake ?? 0) * (oddsAtPrediction ?? 0)) : 0;
}
