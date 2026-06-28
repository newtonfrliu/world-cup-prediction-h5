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
    return status === "won" || status === "lost";
  });

  const won = settled.filter(
    (prediction) => normalizePredictionStatus(prediction.status) === "won",
  ).length;
  const lost = settled.filter(
    (prediction) => normalizePredictionStatus(prediction.status) === "lost",
  ).length;
  const settledTotal = won + lost;

  if (settledTotal === 0) {
    return null;
  }

  return Math.round((won / settledTotal) * 100);
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
