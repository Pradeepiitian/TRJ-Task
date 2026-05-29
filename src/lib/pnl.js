const { eachUtcDay, dayEndMs, utcDateFromMs } = require("./dates");
const { roundUsd, roundDailyRow, roundSummary } = require("./format");

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function applyFillToPosition(positions, fill) {
  const coin = fill?.coin;
  if (!coin || String(coin).startsWith("@")) {
    return;
  }

  const sz = num(fill.sz);
  const px = num(fill.px);
  const side = fill?.side;
  const signedDelta = side === "B" ? sz : -sz;

  let pos = positions.get(coin) || { size: 0, entryPx: 0 };
  const oldSize = pos.size;
  const newSize = oldSize + signedDelta;

  if (Math.abs(oldSize) < 1e-12) {
    pos = { size: newSize, entryPx: px };
  } else if (Math.abs(newSize) < 1e-12) {
    pos = { size: 0, entryPx: 0 };
  } else if (Math.sign(oldSize) === Math.sign(signedDelta)) {
    const totalCost = oldSize * pos.entryPx + signedDelta * px;
    pos = { size: newSize, entryPx: totalCost / newSize };
  } else {
    pos = { size: newSize, entryPx: Math.abs(newSize) > 1e-12 ? pos.entryPx : px };
  }

  positions.set(coin, pos);
}

function unrealizedTotal(positions, marks) {
  let total = 0;

  for (const [coin, pos] of positions.entries()) {
    const mark = marks[coin];
    if (mark == null || Math.abs(pos.size) < 1e-12) {
      continue;
    }
    total += (mark - pos.entryPx) * pos.size;
  }

  return total;
}

function emptyDay(date) {
  return {
    date,
    realized_pnl_usd: 0,
    unrealized_pnl_usd: 0,
    fees_usd: 0,
    funding_usd: 0,
    net_pnl_usd: 0,
    equity_usd: 0,
  };
}

function filterFillsInRange(fills, startMs, endMs) {
  return (fills || []).filter((f) => f?.time >= startMs && f?.time <= endMs);
}

async function buildDailyPnl({
  start,
  end,
  startMs,
  endMs,
  fillsForPositions,
  fundingRows,
  getCandleClose,
  currentAccountValue,
}) {
  const days = eachUtcDay(start, end);
  const dailyMap = {};

  for (const d of days) {
    dailyMap[d] = emptyDay(d);
  }

  const fillsInRange = filterFillsInRange(fillsForPositions, startMs, endMs);

  for (const fill of fillsInRange) {
    const date = utcDateFromMs(fill?.time);
    if (!dailyMap[date]) {
      continue;
    }
    dailyMap[date].realized_pnl_usd += num(fill?.closedPnl);
    dailyMap[date].fees_usd += num(fill?.fee);
  }

  for (const row of fundingRows || []) {
    const date = utcDateFromMs(row?.time);
    if (!dailyMap[date]) {
      continue;
    }
    dailyMap[date].funding_usd += num(row?.delta?.usdc);
  }

  const sortedFills = [...(fillsForPositions || [])].sort((a, b) => a.time - b.time);
  const positions = new Map();
  let fillIdx = 0;
  let prevUnrealized = 0;
  const closeCache = {};

  for (const date of days) {
    const endMsDay = dayEndMs(date);

    while (fillIdx < sortedFills.length && sortedFills[fillIdx].time <= endMsDay) {
      applyFillToPosition(positions, sortedFills[fillIdx]);
      fillIdx += 1;
    }

    const marks = {};
    for (const [coin, pos] of positions.entries()) {
      if (Math.abs(pos.size) < 1e-12) {
        continue;
      }

      const key = `${coin}:${date}`;
      if (closeCache[key] === undefined) {
        closeCache[key] = await getCandleClose(coin, endMsDay);
      }
      marks[coin] = closeCache[key] ?? pos.entryPx;
    }

    const totalUnrealized = unrealizedTotal(positions, marks);
    dailyMap[date].unrealized_pnl_usd = totalUnrealized - prevUnrealized;
    prevUnrealized = totalUnrealized;

    const row = dailyMap[date];
    row.net_pnl_usd =
      row.realized_pnl_usd +
      row.unrealized_pnl_usd -
      row.fees_usd +
      row.funding_usd;
  }

  const summary = days.reduce(
    (acc, d) => {
      const row = dailyMap[d];
      acc.total_realized_usd += row.realized_pnl_usd;
      acc.total_unrealized_usd += row.unrealized_pnl_usd;
      acc.total_fees_usd += row.fees_usd;
      acc.total_funding_usd += row.funding_usd;
      acc.net_pnl_usd += row.net_pnl_usd;
      return acc;
    },
    {
      total_realized_usd: 0,
      total_unrealized_usd: 0,
      total_fees_usd: 0,
      total_funding_usd: 0,
      net_pnl_usd: 0,
    }
  );

  const accountValue = num(currentAccountValue);
  let equity =
    accountValue > 0 ? accountValue - summary.net_pnl_usd : 0;

  const daily = days.map((d) => {
    equity += dailyMap[d].net_pnl_usd;
    dailyMap[d].equity_usd = equity;
    return roundDailyRow(dailyMap[d]);
  });

  return {
    daily,
    summary: roundSummary(summary),
  };
}

module.exports = {
  buildDailyPnl,
  applyFillToPosition,
  num,
  filterFillsInRange,
};
