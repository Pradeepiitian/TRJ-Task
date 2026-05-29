# Token Analytics API

Node.js + Express backend for:

- **Token Insight** — CoinGecko data + AI summary (`POST /api/token/:id/insight`)
- **HyperLiquid PnL** — daily realized/unrealized PnL (`GET /api/hyperliquid/:wallet/pnl`)

## Requirements

- Node.js 20+
- Docker (optional)
- OpenAI API key (or Ollama for local AI)

## Setup (local)

```bash
npm install
cp .env.example .env
```

Edit `.env` and set `OPENAI_API_KEY`.

```bash
npm run dev
```

Health check: `http://localhost:3000/health`

## Setup (Docker)

```bash
cp .env.example .env
# edit .env
docker compose up --build
```

## API examples

### Token insight

```bash
curl -X POST http://localhost:3000/api/token/bitcoin/insight ^
  -H "Content-Type: application/json" ^
  -d "{\"vs_currency\":\"usd\",\"history_days\":30}"
```

### HyperLiquid daily PnL

```bash
curl "http://localhost:3000/api/hyperliquid/0xYOUR_WALLET/pnl?start=2025-08-01&end=2025-08-07"
```

## AI configuration

| Provider | Env vars |
|----------|----------|
| OpenAI (default) | `AI_PROVIDER=openai`, `OPENAI_API_KEY`, `OPENAI_MODEL` |
| Ollama | `AI_PROVIDER=ollama`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL` |

Do not commit `.env`. Use `.env.example` as a template.

## PnL calculation notes

- Days are **UTC** (`YYYY-MM-DD`).
- **Realized** and **fees** come from `userFillsByTime` (`closedPnl`, `fee`).
- **Funding** comes from `userFunding` (`delta.usdc`).
- **Unrealized** is the day-over-day change in mark-to-market on open perp positions (1d candle close).
- **Net PnL** = realized + unrealized − fees + funding.
- Max date range: 90 days per request.

## Tests

```bash
npm test
```

## Project layout

```
src/
  index.js           # app entry
  config.js          # env
  clients/           # CoinGecko, HyperLiquid, AI
  lib/               # dates, pnl math, validation
  routes/            # HTTP handlers
tests/
```
