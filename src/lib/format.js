function roundUsd(value, decimals = 4) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return 0;
  }
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

function roundDailyRow(row) {
  return {
    date: row.date,
    realized_pnl_usd: roundUsd(row.realized_pnl_usd),
    unrealized_pnl_usd: roundUsd(row.unrealized_pnl_usd),
    fees_usd: roundUsd(row.fees_usd),
    funding_usd: roundUsd(row.funding_usd),
    net_pnl_usd: roundUsd(row.net_pnl_usd),
    equity_usd: roundUsd(row.equity_usd),
  };
}

function roundSummary(summary) {
  return {
    total_realized_usd: roundUsd(summary.total_realized_usd),
    total_unrealized_usd: roundUsd(summary.total_unrealized_usd),
    total_fees_usd: roundUsd(summary.total_fees_usd),
    total_funding_usd: roundUsd(summary.total_funding_usd),
    net_pnl_usd: roundUsd(summary.net_pnl_usd),
  };
}

module.exports = { roundUsd, roundDailyRow, roundSummary };
