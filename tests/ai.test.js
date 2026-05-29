const { parseInsight } = require("../src/clients/ai");

describe("parseInsight", () => {
  test("parses valid JSON", () => {
    const raw = '{"reasoning":"ok","sentiment":"Bullish"}';
    expect(parseInsight(raw)).toEqual({
      reasoning: "ok",
      sentiment: "Bullish",
    });
  });

  test("strips markdown fences", () => {
    const raw = '```json\n{"reasoning":"x","sentiment":"Neutral"}\n```';
    expect(parseInsight(raw).sentiment).toBe("Neutral");
  });

  test("rejects invalid sentiment", () => {
    expect(() =>
      parseInsight('{"reasoning":"x","sentiment":"Maybe"}')
    ).toThrow("Invalid insight shape");
  });
});
