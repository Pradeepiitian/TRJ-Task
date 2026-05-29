const { normalizeToken } = require("../src/clients/coingecko");

describe("coingecko client", () => {
  test("normalizeToken maps market fields for assignment response shape", () => {
    const token = normalizeToken(
      {
        id: "chainlink",
        symbol: "link",
        name: "Chainlink",
        market_data: {
          current_price: { usd: 7.23 },
          market_cap: { usd: 3500000000 },
          total_volume: { usd: 120000000 },
          price_change_percentage_24h: -1.2,
        },
      },
      "usd"
    );

    expect(token.id).toBe("chainlink");
    expect(token.symbol).toBe("link");
    expect(token.market_data.current_price_usd).toBe(7.23);
    expect(token.market_data.market_cap_usd).toBe(3500000000);
    expect(token.market_data.price_change_percentage_24h).toBe(-1.2);
  });
});
