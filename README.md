# x402 Payment Skill

Pay-per-call API access to AIsa endpoints using the [x402](https://www.x402.org/) HTTP payment protocol. No API key needed — pay with USDC on [Arc testnet](https://testnet.arcscan.app/) via [Circle Gateway](https://www.circle.com/gateway).

**79 endpoints** across Twitter, Financial, Search, Scholar, Perplexity, and YouTube. Prices range from $0.00044 to $0.12 per call.

## How It Works

```
Agent ──► AIsa API (HTTP 402) ──► Agent signs EIP-712 payment ──► API returns data
                                         │
                               Circle Gateway (batched USDC settlement)
```

## Quick Start

```bash
# 1. Install dependencies
npm install -g @open-wallet-standard/core
npm install

# 2. Create a wallet
ows wallet create --name my-agent

# 3. Fund with testnet USDC from https://faucet.circle.com/ (select Arc Testnet)

# 4. Deposit into Circle Gateway
export OWS_MNEMONIC="your twelve word mnemonic phrase here"
node scripts/setup.mjs all       # approve + deposit 10 USDC

# 5. Make a paid request
node scripts/x402_client.mjs GET "https://api.aisa.one/apis/v2/twitter/user/info?userName=jack"
```

### 5. View Transaction History

Compile on-chain and off-chain spending activity for your wallet:

**On-chain transactions** (approve, deposit):

```bash
# Get total transaction count
curl -s -X POST https://rpc.testnet.arc.network \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_getTransactionCount","params":["<WALLET_ADDRESS>","latest"]}'

# Fetch a specific transaction receipt
curl -s -X POST https://rpc.testnet.arc.network \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_getTransactionReceipt","params":["<TX_HASH>"]}'
```

Receipt fields: `transactionHash`, `blockNumber` (hex), `status` (`0x1` = success), `gasUsed` (hex), `to` (contract address). Known contracts:
- `0x3600000000000000000000000000000000000000` — USDC Token (approve txs)
- `0x0077777d7eba4688bdef3e311b846f25870a19b9` — Gateway (deposit txs)

**Off-chain x402 API costs:** Each API call's cost is listed in [references/endpoint-catalog.md](./references/endpoint-catalog.md). Track endpoint, price, and total spend across calls.

**Current balance:**

```bash
node scripts/setup.mjs balance
```

This shows ERC-20 USDC in wallet, Gateway allowance, and remaining Gateway deposit.

Known request-shape caveats from live testing:

- Twitter user endpoints require `userName`, not `screen_name`
- Polymarket and Kalshi search require `status=open|closed`
- Perplexity endpoints require `model` in the JSON body
- YouTube search requires both `q` and `engine=youtube`
- `scholar/search/explain` is a follow-up endpoint that requires `search_id` in the body
- `matching-markets/sports` requires `kalshi_ticker` or `polymarket_market_slug`

The client outputs JSON to stdout (for piping) and status info to stderr.

For programmatic use in Node.js, import the `createPayingFetch` function:

```javascript
import { createPayingFetch } from "./scripts/x402_client.mjs";

const { fetch: payingFetch, address } = createPayingFetch(process.env.OWS_MNEMONIC);
const res = await payingFetch("https://api.aisa.one/apis/v2/scholar/search/scholar?query=AI", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
});
const data = await res.json();
```

> **Note:** The AIsa proxy uses a custom EIP-712 domain where `verifyingContract` is the Gateway contract (from `extra.verifyingContract` in the 402 response), not the USDC asset address. The standard `@x402/evm` `ExactEvmScheme` does not handle this — the included `GatewayEvmScheme` in `x402_client.mjs` handles it. See [SKILL.md](./SKILL.md) for the full implementation.

## Endpoint Catalog

All endpoints use base URL `https://api.aisa.one` with `/apis/v2/` paths.

### Twitter (28 endpoints)

| Endpoint | Price |
|----------|------:|
| `/apis/v2/twitter/user/info` | $0.00044 |
| `/apis/v2/twitter/user/last_tweets` | $0.00360 |
| `/apis/v2/twitter/user/followers` | $0.03600 |
| `/apis/v2/twitter/user/followings` | $0.03600 |
| `/apis/v2/twitter/tweet/advanced_search` | $0.00220 |
| `/apis/v2/twitter/post_twitter` | $0.01000 |
| ... and 22 more | |

### Search & Prediction Markets (20 endpoints)

| Endpoint | Price |
|----------|------:|
| `/apis/v2/tavily/search` | $0.00960 |
| `/apis/v2/polymarket/markets` | $0.01000 |
| `/apis/v2/kalshi/markets` | $0.01000 |
| `/apis/v2/matching-markets/sports` | $0.01000 |
| ... and 16 more | |

### Financial (22 endpoints)

| Endpoint | Price |
|----------|------:|
| `/apis/v2/financial/analyst-estimates` | $0.12000 |
| `/apis/v2/financial/prices` | $0.02400 |
| `/apis/v2/financial/financials/income-statements` | $0.04800 |
| `/apis/v2/financial/financials` (all statements) | $0.12000 |
| ... and 18 more | |

### Scholar & Search (4 endpoints)

| Endpoint | Price |
|----------|------:|
| `/apis/v2/scholar/search/scholar` | $0.00240 |
| `/apis/v2/scholar/search/web` | $0.00240 |
| `/apis/v2/scholar/search/mixed` | $0.00240 |
| `/apis/v2/scholar/search/explain` | $0.00240 |

### Perplexity AI (4 endpoints)

| Endpoint | Price |
|----------|------:|
| `/apis/v2/perplexity/sonar` | $0.01200 |
| `/apis/v2/perplexity/sonar-pro` | $0.01200 |
| `/apis/v2/perplexity/sonar-reasoning-pro` | $0.01200 |
| `/apis/v2/perplexity/sonar-deep-research` | $0.01200 |

### YouTube (1 endpoint)

| Endpoint | Price |
|----------|------:|
| `/apis/v2/youtube/search` | $0.00240 |

For the complete priced catalog of all 79 endpoints, see [references/endpoint-catalog.md](./references/endpoint-catalog.md).

## Key Details

| Item | Value |
|------|-------|
| Chain | Arc Testnet (chain ID `5042002`) |
| RPC | `https://rpc.testnet.arc.network` |
| USDC Token | `0x3600000000000000000000000000000000000000` |
| Gateway Contract | `0x0077777d7eba4688bdef3e311b846f25870a19b9` |
| API Base URL | `https://api.aisa.one/apis/v2/` |

## Documentation

- **[SKILL.md](./SKILL.md)** — Full agent instructions, decision flow, examples, error handling, and guardrails
- **[references/endpoint-catalog.md](./references/endpoint-catalog.md)** — Complete priced catalog of all 79 endpoints
- **[references/troubleshooting.md](./references/troubleshooting.md)** — Extended failure diagnostics
- **[references/setup.md](./references/setup.md)** — Environment and runtime notes

## Resources

- [x402 Protocol](https://www.x402.org/) — HTTP payment standard
- [Open Wallet Standard](https://openwallet.sh/) — Local wallet management for agents
- [Circle Gateway](https://developers.circle.com/gateway/concepts/technical-guide) — Batched USDC settlement
- [Arc Testnet](https://docs.arc.network/) — Circle's EVM L1 with native USDC
- [AIsa API Docs](https://docs.aisa.one) — Full endpoint documentation
