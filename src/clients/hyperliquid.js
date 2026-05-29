const config = require("../config");

const FILL_LOOKBACK_MS = 90 * 24 * 60 * 60 * 1000;

async function postInfo(body) {
  let res;
  try {
    res = await fetch(config.hyperliquidInfoUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    const err = new Error("Could not reach HyperLiquid API");
    err.status = 502;
    throw err;
  }

  if (!res.ok) {
    const err = new Error(`HyperLiquid HTTP ${res.status}`);
    err.status = 502;
    throw err;
  }

  return res.json();
}

async function getUserRole(user) {
  return postInfo({ type: "userRole", user });
}

async function fetchPaginated(user, type, startMs, endMs, pageLimit) {
  const all = [];
  let cursor = startMs;

  while (cursor <= endMs) {
    const batch = await postInfo({
      type,
      user,
      startTime: cursor,
      endTime: endMs,
    });

    if (!Array.isArray(batch) || batch.length === 0) {
      break;
    }

    all.push(...batch);
    const lastTime = batch[batch.length - 1]?.time;
    if (lastTime == null || batch.length < pageLimit) {
      break;
    }
    cursor = lastTime + 1;
  }

  return all;
}

async function fetchAllFills(user, startMs, endMs) {
  return fetchPaginated(user, "userFillsByTime", startMs, endMs, 2000);
}

async function fetchFillsForPositions(user, startMs, endMs) {
  const lookbackStart = Math.max(0, startMs - FILL_LOOKBACK_MS);
  return fetchAllFills(user, lookbackStart, endMs);
}

async function fetchFunding(user, startMs, endMs) {
  return fetchPaginated(user, "userFunding", startMs, endMs, 500);
}

async function getClearinghouseState(user) {
  return postInfo({ type: "clearinghouseState", user });
}

function getAccountValue(state) {
  const value =
    state?.marginSummary?.accountValue ??
    state?.crossMarginSummary?.accountValue ??
    state?.clearinghouseState?.marginSummary?.accountValue;

  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

async function getCandleClose(coin, dayEndMs) {
  const dayStart = dayEndMs - 24 * 60 * 60 * 1000;
  const candles = await postInfo({
    type: "candleSnapshot",
    req: {
      coin,
      interval: "1d",
      startTime: dayStart,
      endTime: dayEndMs,
    },
  });

  if (!Array.isArray(candles) || candles.length === 0) {
    return null;
  }

  const last = candles[candles.length - 1];
  const close = parseFloat(last?.c);
  return Number.isFinite(close) ? close : null;
}

module.exports = {
  postInfo,
  getUserRole,
  fetchAllFills,
  fetchFillsForPositions,
  fetchFunding,
  getClearinghouseState,
  getAccountValue,
  getCandleClose,
  FILL_LOOKBACK_MS,
};
