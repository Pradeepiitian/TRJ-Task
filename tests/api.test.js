const request = require("supertest");

jest.mock("../src/clients/ai", () => ({
  getInsight: jest.fn().mockResolvedValue({
    insight: { reasoning: "Price is stable.", sentiment: "Neutral" },
    model: { provider: "openai", model: "gpt-4o-mini" },
  }),
}));

jest.mock("../src/clients/coingecko", () => {
  const actual = jest.requireActual("../src/clients/coingecko");
  return {
    getCoin: jest.fn().mockResolvedValue({
      id: "bitcoin",
      symbol: "btc",
      name: "Bitcoin",
      market_data: {
        current_price: { usd: 50000 },
        market_cap: { usd: 1000000000 },
        total_volume: { usd: 50000000 },
        price_change_percentage_24h: 1.5,
      },
    }),
    getMarketChart: jest.fn().mockResolvedValue({ prices: [[1, 49000]] }),
    normalizeToken: actual.normalizeToken,
  };
});

const app = require("../src/index");

describe("API routes", () => {
  test("GET /health", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test("GET /api/hyperliquid invalid wallet returns 400", async () => {
    const res = await request(app).get(
      "/api/hyperliquid/not-a-wallet/pnl?start=2025-08-01&end=2025-08-02"
    );
    expect(res.status).toBe(400);
  });

  test("GET /api/hyperliquid bad dates returns 400", async () => {
    const wallet = "0x0000000000000000000000000000000000000001";
    const res = await request(app).get(
      `/api/hyperliquid/${wallet}/pnl?start=bad&end=2025-08-02`
    );
    expect(res.status).toBe(400);
  });

  test("POST /api/token/:id/insight returns combined payload", async () => {
    const res = await request(app)
      .post("/api/token/bitcoin/insight")
      .send({ vs_currency: "usd", history_days: 7 });

    expect(res.status).toBe(200);
    expect(res.body.source).toBe("coingecko");
    expect(res.body.token.id).toBe("bitcoin");
    expect(res.body.insight.sentiment).toBe("Neutral");
    expect(res.body.model.provider).toBe("openai");
  });
});
