# x402 Payment Skill

Pay-per-call API access to AIsa endpoints using the [x402](https://www.x402.org/) HTTP payment protocol. No API key needed — pay with USDC on [Arc testnet](https://testnet.arcscan.app/) via [Circle Gateway](https://www.circle.com/gateway).

## How It Works

```
Agent ──► AIsa API (HTTP 402) ──► Agent signs EIP-712 payment ──► API returns data
                                         │
                               Circle Gateway (batched USDC settlement)
```

1. Agent sends a request to a paid `/apis/v2/` endpoint
2. Server responds with HTTP 402 + a `payment-required` header containing accepted payment networks and amounts
3. Agent signs an EIP-712 `TransferWithAuthorization` for USDC via Circle's GatewayWalletBatched contract
4. Agent re-sends the request with the signed payment in headers
5. Server verifies the signature, settles via Circle Gateway, and returns data

## Prerequisites

- **Node.js** (v18+)
- **npm**

```bash
# Install OWS CLI
npm install -g @open-wallet-standard/core

# Install skill dependencies
cd x402-payment && npm install
```

## Setup

### 1. Create a Wallet

```bash
ows wallet create --name my-agent
```

This derives addresses for all supported chains. The EVM address is used for x402 payments.

### 2. Fund with Testnet USDC

Get free testnet USDC from the Circle faucet:

**https://faucet.circle.com/**

Select **Arc Testnet** and paste your EVM wallet address.

Verify on the block explorer: **https://testnet.arcscan.app/**

### 3. Deposit into Circle Gateway

The x402 proxy settles payments through Circle's GatewayWalletBatched contract. You must deposit USDC into the contract before making paid requests.

| Contract | Address |
|----------|---------|
| USDC Token | `0x3600000000000000000000000000000000000000` |
| GatewayWalletBatched | `0x0077777d7eba4688bdef3e311b846f25870a19b9` |

Use the setup script to approve and deposit in one step:

```bash
export OWS_MNEMONIC="your twelve word mnemonic phrase here"
node scripts/setup.mjs all               # approve + deposit 10 USDC
node scripts/setup.mjs deposit --amount 5 # deposit a custom amount
node scripts/setup.mjs balance            # check balances
```

> **Warning:** Do NOT directly transfer USDC to the Gateway address. You must call `deposit()` or the funds will be lost.

### 4. Make Paid Requests

```bash
export OWS_MNEMONIC="your twelve word mnemonic phrase here"

# Scholar search
node scripts/x402_client.mjs POST "https://api.aisa.one/apis/v2/scholar/search/scholar?query=AI" --body '{}'

# Polymarket markets (status is required when using search)
node scripts/x402_client.mjs GET "https://api.aisa.one/apis/v2/polymarket/markets?search=election&status=open"

# Tavily search
node scripts/x402_client.mjs POST "https://api.aisa.one/apis/v2/tavily/search" --body '{"query":"latest AI news"}'

# Twitter user info (use userName, not screen_name)
node scripts/x402_client.mjs GET "https://api.aisa.one/apis/v2/twitter/user/info?userName=jack"

# Twitter recent tweets
node scripts/x402_client.mjs GET "https://api.aisa.one/apis/v2/twitter/user/last_tweets?userName=jack"

# Kalshi markets (status is required when using search)
node scripts/x402_client.mjs GET "https://api.aisa.one/apis/v2/kalshi/markets?search=election&status=open"

# Financial statements
node scripts/x402_client.mjs GET "https://api.aisa.one/apis/v2/financial/financials/income-statements?ticker=AAPL"
node scripts/x402_client.mjs GET "https://api.aisa.one/apis/v2/financial/financials?ticker=AAPL"

# Scholar mixed search
node scripts/x402_client.mjs POST "https://api.aisa.one/apis/v2/scholar/search/mixed?query=bitcoin" --body '{}'

# Perplexity (model is required in the JSON body)
node scripts/x402_client.mjs POST "https://api.aisa.one/apis/v2/perplexity/sonar" --body '{"model":"sonar","messages":[{"role":"user","content":"What is Bitcoin? Keep it brief."}]}'

# YouTube search (requires both q and engine)
node scripts/x402_client.mjs GET "https://api.aisa.one/apis/v2/youtube/search?q=bitcoin&engine=youtube"
```

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

### Financial (23 endpoints)

| Endpoint | Price |
|----------|------:|
| `/apis/v2/financial/company/facts` | $0.00000 |
| `/apis/v2/financial/prices` | $0.01200 |
| `/apis/v2/financial/financials/income-statements` | $0.04800 |
| `/apis/v2/financial/financials` (all statements) | $0.12000 |
| ... and 19 more | |

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

For the complete catalog with all endpoints, see [SKILL.md](./SKILL.md#full-x402-endpoint-catalog).

## Key Details

| Item | Value |
|------|-------|
| Chain | Arc Testnet (chain ID `5042002`) |
| RPC | `https://rpc.testnet.arc.network` |
| Explorer | https://testnet.arcscan.app/ |
| Faucet | https://faucet.circle.com/ |
| USDC Token | `0x3600000000000000000000000000000000000000` |
| USDC Decimals | 6 (ERC-20 token), 18 (native gas) |
| Gateway Contract | `0x0077777d7eba4688bdef3e311b846f25870a19b9` |
| API Base URL | `https://api.aisa.one` |
| API Path Prefix | `/apis/v2/` (x402) vs `/apis/v1/` (API key) |

## Troubleshooting

| Error | Fix |
|-------|-----|
| `invalid_signature` | Use `extra.verifyingContract` from the 402 response as the EIP-712 domain `verifyingContract`, not the asset address |
| `insufficient_balance` | Deposit USDC into the Gateway contract via `deposit()` |
| `UnsupportedChain` (ows CLI) | Use the JS client — `ows pay request` has a known issue matching EVM testnet chain IDs |
| `500 Invalid price: $0.000000` | For endpoints with a $0 price, still process them through the regular x402 flow; if this error appears, treat it as an upstream pricing bug rather than switching auth modes |

## Resources

- [SKILL.md](./SKILL.md) — Full agent instructions with code
- [x402 Protocol](https://www.x402.org/) — HTTP payment standard
- [Open Wallet Standard](https://openwallet.sh/) — Local wallet management for agents
- [Circle Gateway](https://developers.circle.com/gateway/concepts/technical-guide) — Batched USDC settlement
- [Arc Testnet](https://docs.arc.network/) — Circle's EVM L1 with native USDC
- [AIsa API Docs](https://docs.aisa.one) — Full endpoint documentation
