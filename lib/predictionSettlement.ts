export type PredictionChoice = string | null | undefined;
export type MatchResultValue = string | null | undefined;
export type MarketKey = "h2h_90" | "advance" | "totals_90";
export type SettlementStatus = "won" | "lost" | "void" | "half_win" | "half_lost";
export type SettlementResultSource =
  | MatchResultValue
  | {
      betting_result?: MatchResultValue;
      result?: MatchResultValue;
      advancement_winner?: MatchResultValue;
      regular_home_score?: number | null;
      regular_away_score?: number | null;
      final_home_score?: number | null;
      final_away_score?: number | null;
      home_score?: number | null;
      away_score?: number | null;
    };

export type MarketPrediction = {
  prediction?: PredictionChoice;
  market_key?: string | null;
  selection_key?: string | null;
  line?: number | null;
  stake?: number | null;
  odds_at_prediction?: number | null;
};

export type MarketSettlementResult = {
  status: SettlementStatus;
  payout: number;
  points: number;
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

export function getMarketKey(prediction: MarketPrediction): MarketKey {
  const marketKey = (prediction.market_key ?? "h2h_90").trim().toLowerCase();

  if (marketKey === "advance" || marketKey === "totals_90") {
    return marketKey;
  }

  return "h2h_90";
}

export function getSelectionKey(prediction: MarketPrediction) {
  return (
    prediction.selection_key ??
    prediction.prediction ??
    ""
  )
    .trim()
    .toLowerCase();
}

export function getTotalGoalsForSettlement(source: SettlementResultSource) {
  if (!source || typeof source !== "object") {
    return null;
  }

  const regularHome = source.regular_home_score;
  const regularAway = source.regular_away_score;

  if (typeof regularHome === "number" && typeof regularAway === "number") {
    return regularHome + regularAway;
  }

  const home = source.home_score;
  const away = source.away_score;

  if (typeof home === "number" && typeof away === "number") {
    return home + away;
  }

  return null;
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

function calculateMarketPayout(
  stake: number | null | undefined,
  oddsAtPrediction: number | null | undefined,
  status: SettlementStatus,
) {
  const stakeValue = stake ?? 0;
  const oddsValue = oddsAtPrediction ?? 0;

  if (status === "won") {
    return Math.round(stakeValue * oddsValue);
  }

  if (status === "void") {
    return stakeValue;
  }

  if (status === "half_win") {
    return Math.round((stakeValue / 2) * oddsValue + stakeValue / 2);
  }

  if (status === "half_lost") {
    return Math.round(stakeValue / 2);
  }

  return 0;
}

function calculateMarketPoints(
  oddsAtPrediction: number | null | undefined,
  status: SettlementStatus,
) {
  const oddsValue = oddsAtPrediction ?? 0;

  if (status === "won") {
    return Math.round(oddsValue * 100);
  }

  if (status === "half_win") {
    return Math.round(oddsValue * 50);
  }

  return 0;
}

function settleHalfTotal(
  selectionKey: string,
  line: number,
  totalGoals: number,
): "won" | "lost" | "void" {
  if (selectionKey === "over") {
    if (totalGoals > line) return "won";
    if (totalGoals === line) return "void";
    return "lost";
  }

  if (totalGoals < line) return "won";
  if (totalGoals === line) return "void";
  return "lost";
}

function splitAsianLine(line: number) {
  const doubled = line * 2;

  if (Number.isInteger(doubled)) {
    return [line, line];
  }

  const lower = Math.floor(line * 2) / 2;
  const upper = Math.ceil(line * 2) / 2;

  return [lower, upper];
}

export function settleAsianTotal(
  selectionKey: string,
  line: number,
  totalGoals: number,
  stake: number | null | undefined,
  oddsAtPrediction: number | null | undefined,
): MarketSettlementResult {
  const normalizedSelection = selectionKey.trim().toLowerCase();

  if (normalizedSelection !== "over" && normalizedSelection !== "under") {
    return { status: "lost", payout: 0, points: 0 };
  }

  const [firstLine, secondLine] = splitAsianLine(line);
  const first = settleHalfTotal(normalizedSelection, firstLine, totalGoals);
  const second = settleHalfTotal(normalizedSelection, secondLine, totalGoals);
  const outcomes = [first, second];
  let status: SettlementStatus;

  if (outcomes.every((outcome) => outcome === "won")) {
    status = "won";
  } else if (outcomes.every((outcome) => outcome === "lost")) {
    status = "lost";
  } else if (outcomes.every((outcome) => outcome === "void")) {
    status = "void";
  } else if (outcomes.includes("won") && outcomes.includes("void")) {
    status = "half_win";
  } else if (outcomes.includes("lost") && outcomes.includes("void")) {
    status = "half_lost";
  } else if (outcomes.includes("won") && outcomes.includes("lost")) {
    status = totalGoals > line ? "won" : "lost";
  } else {
    status = "lost";
  }

  return {
    status,
    payout: calculateMarketPayout(stake, oddsAtPrediction, status),
    points: calculateMarketPoints(oddsAtPrediction, status),
  };
}

export function settlePredictionMarket(
  prediction: MarketPrediction,
  match: SettlementResultSource,
): MarketSettlementResult | null {
  const marketKey = getMarketKey(prediction);
  const selectionKey = getSelectionKey(prediction);

  if (marketKey === "advance") {
    const advancementWinner =
      match && typeof match === "object"
        ? normalizeMatchResult(match.advancement_winner)
        : "";

    if (!advancementWinner) {
      return null;
    }

    const normalizedSelection =
      selectionKey === "home_advance"
        ? "home"
        : selectionKey === "away_advance"
          ? "away"
          : "";
    const status: SettlementStatus =
      normalizedSelection && normalizedSelection === advancementWinner
        ? "won"
        : "lost";

    return {
      status,
      payout: calculateMarketPayout(
        prediction.stake,
        prediction.odds_at_prediction,
        status,
      ),
      points: calculateMarketPoints(prediction.odds_at_prediction, status),
    };
  }

  if (marketKey === "totals_90") {
    const totalGoals = getTotalGoalsForSettlement(match);
    const line = prediction.line;

    if (totalGoals === null || typeof line !== "number") {
      return null;
    }

    return settleAsianTotal(
      selectionKey,
      line,
      totalGoals,
      prediction.stake,
      prediction.odds_at_prediction,
    );
  }

  const isHit = isPredictionHit(prediction.prediction ?? selectionKey, match);
  const status: SettlementStatus = isHit ? "won" : "lost";

  return {
    status,
    payout: calculateMarketPayout(
      prediction.stake,
      prediction.odds_at_prediction,
      status,
    ),
    points: calculateMarketPoints(prediction.odds_at_prediction, status),
  };
}
