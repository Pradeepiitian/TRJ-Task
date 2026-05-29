const config = require("../config");

async function getCoin(id) {
  const url = `${config.coingeckoBaseUrl}/coins/${encodeURIComponent(id)}?localization=false&tickers=false&community_data=false&developer_data=false`;
  const res = await fetch(url);
  if (res.status === 404) {
    const err = new Error("Token not found");
    err.status = 404;
    throw err;
  }
  if (!res.ok) {
    const err = new Error(`CoinGecko error: ${res.status}`);
    err.status = 502;
    throw err;
  }
  return res.json();
}

async function getMarketChart(id, vsCurrency, days) {
  const url = `${config.coingeckoBaseUrl}/coins/${encodeURIComponent(id)}/market_chart?vs_currency=${vsCurrency}&days=${days}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = new Error(`CoinGecko chart error: ${res.status}`);
    err.status = 502;
    throw err;
  }
  return res.json();
}

function normalizeToken(data, vsCurrency) {
  const md = data?.market_data || {};
  return {
    id: data?.id,
    symbol: data?.symbol,
    name: data?.name,
    market_data: {
      current_price_usd: md?.current_price?.[vsCurrency] ?? md?.current_price?.usd,
      market_cap_usd: md?.market_cap?.[vsCurrency] ?? md?.market_cap?.usd,
      total_volume_usd: md?.total_volume?.[vsCurrency] ?? md?.total_volume?.usd,
      price_change_percentage_24h: md?.price_change_percentage_24h,
    },
  };
}

module.exports = { getCoin, getMarketChart, normalizeToken };
