type SettledPrediction = {
  status: string | null;
  settled_at?: string | null;
  matches?: {
    start_time?: string | null;
  } | null;
};

function normalizePredictionStatus(status: string | null | undefined) {
  return (status ?? "active").trim().toLowerCase();
}

function getSettledTime(prediction: SettledPrediction) {
  const value = prediction.settled_at ?? prediction.matches?.start_time ?? "";
  const time = new Date(value).getTime();

  return Number.isFinite(time) ? time : 0;
}

export function calculatePlayerWinRate(predictions: SettledPrediction[]) {
  const settled = predictions.filter((prediction) => {
    const status = normalizePredictionStatus(prediction.status);
    return (
      status === "won" ||
      status === "lost" ||
      status === "half_win" ||
      status === "half_lost"
    );
  });

  const won = settled.filter(
    (prediction) => normalizePredictionStatus(prediction.status) === "won",
  ).length;
  const halfWon = settled.filter(
    (prediction) => normalizePredictionStatus(prediction.status) === "half_win",
  ).length;
  const lost = settled.filter(
    (prediction) => normalizePredictionStatus(prediction.status) === "lost",
  ).length;
  const halfLost = settled.filter(
    (prediction) => normalizePredictionStatus(prediction.status) === "half_lost",
  ).length;
  const settledTotal = won + halfWon + halfLost + lost;

  if (settledTotal === 0) {
    return null;
  }

  return Math.round(((won + halfWon * 0.5) / settledTotal) * 100);
}

export function calculatePlayerWinStreak(predictions: SettledPrediction[]) {
  const settled = predictions
    .filter((prediction) => {
      const status = normalizePredictionStatus(prediction.status);
      return status === "won" || status === "lost";
    })
    .sort((left, right) => getSettledTime(right) - getSettledTime(left));

  let streak = 0;

  for (const prediction of settled) {
    const status = normalizePredictionStatus(prediction.status);

    if (status === "won") {
      streak += 1;
      continue;
    }

    break;
  }

  return streak;
}
