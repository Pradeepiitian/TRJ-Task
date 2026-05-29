const config = require("../config");

async function postInfo(body) {
  const res = await fetch(config.hyperliquidInfoUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
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

async function fetchAllFills(user, startMs, endMs) {
  const all = [];
  let cursor = startMs;

  while (cursor <= endMs) {
    const batch = await postInfo({
      type: "userFillsByTime",
      user,
      startTime: cursor,
      endTime: endMs,
    });

    if (!Array.isArray(batch) || batch.length === 0) {
      break;
    }

    all.push(...batch);
    const lastTime = batch[batch.length - 1]?.time;
    if (lastTime == null || batch.length < 2000) {
      break;
    }
    cursor = lastTime + 1;
  }

  return all;
}

async function fetchFunding(user, startMs, endMs) {
  const all = [];
  let cursor = startMs;

  while (cursor <= endMs) {
    const batch = await postInfo({
      type: "userFunding",
      user,
      startTime: cursor,
      endTime: endMs,
    });

    if (!Array.isArray(batch) || batch.length === 0) {
      break;
    }

    all.push(...batch);
    const lastTime = batch[batch.length - 1]?.time;
    if (lastTime == null || batch.length < 500) {
      break;
    }
    cursor = lastTime + 1;
  }

  return all;
}

async function getClearinghouseState(user) {
  return postInfo({ type: "clearinghouseState", user });
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
  fetchFunding,
  getClearinghouseState,
  getCandleClose,
};
