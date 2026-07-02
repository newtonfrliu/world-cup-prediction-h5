export type PredictionChoice = string | null | undefined;
export type MatchResultValue = string | null | undefined;
export type SettlementResultSource =
  | MatchResultValue
  | {
      betting_result?: MatchResultValue;
      result?: MatchResultValue;
    };

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

export function getBettingResultForSettlement(source: SettlementResultSource) {
  if (source && typeof source === "object") {
    return normalizeMatchResult(source.betting_result ?? source.result);
  }

  return normalizeMatchResult(source);
}

export function isPredictionHit(
  prediction: PredictionChoice,
  result: SettlementResultSource,
) {
  const normalizedPrediction = normalizePredictionChoice(prediction);
  const normalizedResult = getBettingResultForSettlement(result);

  return Boolean(normalizedPrediction) && normalizedPrediction === normalizedResult;
}

export function getPredictionSettlementStatus(
  prediction: PredictionChoice,
  result: SettlementResultSource,
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
