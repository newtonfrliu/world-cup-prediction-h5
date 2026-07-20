export const finalApiUpdateCutoffAt = "2026-07-20T04:24:00.000Z";
export const finalApiUpdateCutoffLabel = "2026-07-20 12:24 Asia/Hong_Kong";

function isManualStopEnabled() {
  return process.env.WORLD_CUP_API_UPDATES_STOPPED === "true";
}

export function isWorldCupApiUpdateStopped(now = new Date()) {
  return (
    isManualStopEnabled() ||
    now.getTime() >= new Date(finalApiUpdateCutoffAt).getTime()
  );
}

export function getWorldCupApiUpdateStoppedMessage() {
  return `World Cup API updates stopped after the final manual full update. Stop time: ${finalApiUpdateCutoffLabel}.`;
}

export function assertWorldCupApiUpdateAllowed(now = new Date()) {
  if (isWorldCupApiUpdateStopped(now)) {
    throw new Error(getWorldCupApiUpdateStoppedMessage());
  }
}
