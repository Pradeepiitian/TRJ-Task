const { rulesInsightFromToken } = require("../src/clients/ai");

describe("rulesInsightFromToken", () => {
  test("returns valid insight shape", () => {
    const insight = rulesInsightFromToken({
      id: "bitcoin",
      symbol: "btc",
      name: "Bitcoin",
      market_data: {
        current_price_usd: 50000,
        price_change_percentage_24h: 3.5,
        market_cap_usd: 1e12,
        total_volume_usd: 2e10,
      },
    });

    expect(insight.reasoning).toContain("Bitcoin");
    expect(insight.sentiment).toBe("Bullish");
  });
});
