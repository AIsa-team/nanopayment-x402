---
name: nanopayment-x402
description: Access AIsa x402-paid /apis/v2/ endpoints using mainnet USDC and Circle Gateway across 11 EVM chains (Ethereum, Base, Avalanche, Arbitrum, OP, Polygon, Unichain, Sonic, World Chain, Sei, HyperEVM). Use when setting up x402 payments, creating or funding a wallet, depositing into Circle Gateway on a specific chain, picking the right AIsa endpoint for a task, estimating per-call cost, or making paid AIsa API calls without an API key. 104 endpoints across Twitter, Financial, Search, Scholar, Perplexity, YouTube, and CoinGecko categories.
---

# nanopayment-x402

Pay-per-call API access to 104 AIsa endpoints via the x402 HTTP payment protocol. No API key needed — pays with USDC on any of 11 EVM mainnets via Circle Gateway. (Arc Testnet is in the chain registry for legacy wallets but is no longer accepted by AIsa for paid endpoints.)

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

> **Note:** The AIsa proxy uses a custom EIP-712 domain where `verifyingContract` is the Gateway contract (from `extra.verifyingContract` in the 402 response), not the USDC asset address. The standard `@x402/evm` `ExactEvmScheme` does not handle this — the included `GatewayEvmScheme` in `x402_client.mjs` handles it.

## Quick Reference

| Item | Value |
|------|-------|
| API Base | `https://api.aisa.one/apis/v2/` |
| Accepted chains (mainnet) | `ethereum` `base` `avalanche` `arbitrum` `optimism` `polygon` `unichain` `sonic` `worldchain` `sei` `hyperevm` |
| Chain selection | `--chain <key\|id>` flag or `OWS_CHAIN` env (no default — pick explicitly) |
| Gateway Wallet (mainnet) | `0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE` (same on every EVM mainnet) |
| USDC | 6 decimals on every chain. Per-chain USDC contract addresses in `scripts/chains.mjs` |
| Per-chain RPC override | `OWS_RPC_<KEY>` env (e.g. `OWS_RPC_BASE`) |
| Chain registry | `scripts/chains.mjs` |
| Endpoint catalog | `references/endpoint-catalog.md` |
| API Path Prefix | `/apis/v2/` (x402) vs `/apis/v1/` (API key) |
| List chains | `node scripts/setup.mjs chains` |

## Prerequisites

- **Node.js** (v18+)
- **npm**

```bash
# Install skill dependencies
npm install
```

## Decision Flow

On every invocation, execute this sequence:

### 1. Check Prerequisites

```bash
bash scripts/check-env.sh
```

If `node`, `npm`, or deps are missing:
```bash
npm install
```

### 2. Ensure Wallet Exists

**If mnemonic found** (check in order: `OWS_MNEMONIC` env, `X402_MNEMONIC` env, local `.env`): proceed to step 3.

**If no mnemonic found**, generate a wallet directly using viem (no interactive terminal needed) and save it to `.env` in one step:

```bash
node --input-type=module -e "
import { generateMnemonic, english, mnemonicToAccount } from 'viem/accounts';
import fs from 'fs';
import path from 'path';
const mnemonic = generateMnemonic(english);
const account = mnemonicToAccount(mnemonic);
const envPath = path.resolve('.env');
fs.writeFileSync(envPath, 'OWS_MNEMONIC=' + mnemonic + '\n');
console.log('MNEMONIC_SAVED=true');
console.log('ADDRESS=' + account.address);
"
```

This generates a BIP-39 mnemonic, derives the Ethereum address, and persists the mnemonic to `.env` — fully automated with no user interaction.

**Mainnet funding policy:** AIsa-accepted chains are mainnets. There is no faucet — the user must fund the wallet with real USDC + native gas. Do NOT attempt to automate funding in a browser.

Get the wallet address:
```bash
node scripts/setup.mjs address
```

Display the wallet address prominently and tell the user:

```
Your new wallet address (click to copy):

`0x<WALLET_ADDRESS>`

Fund this wallet with USDC (and a small amount of native gas) on one of the
11 AIsa-accepted EVM mainnets — e.g. transfer USDC from an exchange or another
wallet to this address on Base, Arbitrum, OP, etc. Pick whichever chain has the
cheapest gas + lowest USDC bridge cost for your situation; the Gateway unifies
balances across all of them.

Run `node scripts/setup.mjs chains` to see the full list.
```

Wait for the user to confirm they have funded the wallet, ask which chain they sent to, then verify:

```bash
node scripts/setup.mjs balance --chain <key>
# or to scan every chain in the registry:
node scripts/setup.mjs balance --all
```

If ERC-20 USDC is still `0` on the chain they specified, the transfer may not have landed — ask them to wait for confirmation or recheck the destination chain.

Once funded, continue to step 3 to approve and deposit into the Gateway on that chain.

### 3. Check Balance and Auto-Deposit

First, identify the active chain — `OWS_CHAIN` env, prior conversation, or ask the user. Then:

```bash
node scripts/setup.mjs balance --chain <key>
# Or scan every chain in the registry:
node scripts/setup.mjs balance --all
```

⚠ Mainnet — every approve/deposit costs real gas and locks real USDC. Confirm with the user before each write op above a small budget. Apply these rules in order on the chosen chain:

| Condition | Action |
|-----------|--------|
| Gateway allowance is `0` on the chosen chain | Run `node scripts/setup.mjs approve --chain <key> --cap <usdc>` to set a bounded approval (recommended: `2 × deposit_amount` or a fixed agent budget). Plain `approve` grants unlimited approval, which maximizes exposure if the Gateway contract is ever compromised. |
| Gateway deposit < 0.5 USDC AND wallet ERC-20 USDC >= 5 | Run `node scripts/setup.mjs deposit --chain <key> --amount 5` (mainnet — confirm amount with user first) |
| Gateway deposit < 0.5 USDC AND wallet ERC-20 USDC < 5 | Wallet underfunded on this chain. Show the user the wallet address (`node scripts/setup.mjs address`) and ask them to fund it on this chain (or to specify a different chain that already has USDC). No automated funding — there is no mainnet faucet. After they confirm a transfer, re-check balance. |
| User wants to deposit across multiple chains in one shot | Run `node scripts/setup.mjs deposit-all --amount <usdc>` first (dry-run prints the plan), then re-run with `--execute` after user confirms. Mainnet — never auto-`--execute` without explicit user approval. |
| Gateway deposit >= 0.5 USDC on any AIsa-accepted chain | Proceed (Gateway unifies balances across chains, so a deposit on any one of them can pay for an API call) |

> **Warning:** Do NOT directly transfer USDC to the Gateway address. You must call `deposit()` or the funds will be lost.
> **Warning:** All operations in this step are real mainnet transactions. Never auto-approve or auto-deposit above the user's stated budget without explicit confirmation.

### 4. Look Up Endpoint

**Before every API call**, look up the endpoint in `references/endpoint-catalog.md`. Extract:
- Exact path and HTTP method
- Per-call price in USD
- Required parameters and caveats

**Earnings Press Releases ticker validation**: When calling `/financial/earnings/press-releases`, first check `references/earnings-press-releases-tickers.md` to confirm the ticker is in the supported list (2776 tickers). If the ticker is not listed, tell the user it is unsupported and suggest `/financial/analyst-estimates` or `/financial/financials/income-statements` instead. This avoids wasting a $0.048 call on an invalid ticker.

**Cost confirmation rule**: If price >= $0.036/call, confirm with the user before calling. Expensive endpoints:
- `twitter/user/followers` ($0.036)
- `twitter/user/followings` ($0.036)
- `financial/analyst-estimates` ($0.120)
- `financial/financial-metrics` ($0.048)
- `financial/financial-metrics/snapshot` ($0.048)
- `financial/earnings/press-releases` ($0.048)
- `financial/financial-metrics` ($0.048)
- `financial/financial-metrics/snapshot` ($0.048)
- `financial/financials/income-statements` ($0.048)
- `financial/financials/balance-sheets` ($0.048)
- `financial/financials/cash-flow-statements` ($0.048)
- `financial/financials/segmented-revenues` ($0.048)
- `financial/insider-trades` ($0.048)
- `financial/institutional-ownership` ($0.048)
- `financial/news` ($0.048)
- `financial/financials` ($0.120) — prefer individual statement endpoints at $0.048 unless user needs all three

**Loop cost rule**: Before looping calls, calculate `count * price` and tell the user the total estimated cost. Wait for confirmation.

### 5. Make the Request

```bash
node scripts/x402_client.mjs <METHOD> "<full_url>" [--body '<json>'] [--chain <key>]
```

The client reads the server's HTTP 402 response and picks a chain from `accepts` that matches the local registry. If `--chain` (or `OWS_CHAIN`) is set and the server offers it, the client uses that one.

POST endpoints with no body still need `--body '{}'`.

Output: JSON on stdout, status info on stderr. Parse stdout for the API response.

### 6. View Transaction History

When the user asks for transaction history, wallet activity, or spending summary, compile both on-chain and off-chain (x402 API) activity:

**On-chain transactions:** For each chain the user has interacted with, look up the per-chain RPC in `scripts/chains.mjs` (or use the chain's block explorer). Fetch transaction count and per-tx receipts via `eth_getTransactionCount` / `eth_getTransactionReceipt` against the appropriate RPC.

Known contracts (same on every EVM mainnet):
- Per-chain USDC token contract — see `scripts/chains.mjs` (approve txs)
- `0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE` — Gateway Wallet (deposit txs)

**Off-chain x402 API calls:** Track all x402 API calls made during the session. For each call, record the endpoint name, path, per-call cost (from `references/endpoint-catalog.md`), and which chain settled the payment. Sum the total API spend.

**Current balance:**

```bash
node scripts/setup.mjs balance --all
```

This shows ERC-20 USDC and Gateway allowance per chain. Gateway deposit balance is unified across chains — query Circle's Gateway REST API (`POST https://gateway-api.circle.com/v1/balances`) for the live unified balance.

**Present the results as three tables:**
1. **On-Chain Transactions** — hash, block, action (Approve/Deposit), target contract, gas used, status
2. **x402 API Calls** — endpoint name, cost per call
3. **Current Balance** — ERC-20 USDC in wallet, remaining Gateway deposit, total available

## Request Examples

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

## Programmatic Usage (Node.js)

```javascript
import { createPayingFetch } from "./scripts/x402_client.mjs";

const { fetch: payingFetch, address } = createPayingFetch(process.env.OWS_MNEMONIC);
const res = await payingFetch("https://api.aisa.one/apis/v2/scholar/search/scholar?query=AI", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
});
const data = await res.json();
```

The client outputs JSON to stdout (for piping) and status info to stderr.

## Endpoint Parameter Caveats

| Endpoint group | Caveat |
|----------------|--------|
| Twitter user endpoints | Use `userName`, NOT `screen_name` |
| Twitter posting (`post_twitter`) | Requires OAuth — see **Twitter Posting Flow** below |
| Polymarket/Kalshi search | Require `status=open\|closed` with `search` param |
| Perplexity endpoints | Require `model` in JSON body (e.g. `"model":"sonar"`) |
| YouTube search | Require both `q` and `engine=youtube` |
| `scholar/search/explain` | Follow-up call; requires `search_id` in body |
| `matching-markets/sports` | Requires `kalshi_ticker` or `polymarket_market_slug` |

### Twitter Posting Flow

Posting a tweet requires Twitter OAuth authorization. Do NOT ask the user for an AIsa API key — the entire flow uses x402-paid endpoints.

1. **Get an auth link** — call the auth endpoint with any placeholder for the required `aisa_api_key` field:
   ```bash
   node scripts/x402_client.mjs POST "https://api.aisa.one/apis/v2/twitter/auth_twitter" --body '{"aisa_api_key":"x402"}'
   ```
   Extract the `auth_url` from the response.

2. **Send the user the auth link** — the user must open the link in their browser and authorize the app on Twitter/X. Do NOT attempt to automate this with browser tools (x.com blocks automation).

3. **Wait for user confirmation** that they have completed authorization.

4. **Post the tweet** — use the `content` field (not `text`):
   ```bash
   node scripts/x402_client.mjs POST "https://api.aisa.one/apis/v2/twitter/post_twitter" --body '{"aisa_api_key":"x402","content":"Your tweet text here"}'
   ```
   The response includes `tweet_id` on success.

## Error Handling

| Error / Status | Diagnosis | Fix |
|----------------|-----------|-----|
| 403 + `"Pre-deduction failed"` | Insufficient Gateway deposit (across all chains) | Run step 3 — confirm chain with user, then `setup.mjs all --chain <key> --amount <N>` |
| `invalid_signature` | Wrong EIP-712 verifyingContract | Already handled by `x402_client.mjs` — if still failing, check `extra.verifyingContract` in 402 response |
| `insufficient_balance` | No USDC deposited in Gateway on any chain | `node scripts/setup.mjs deposit --chain <key> --amount 5` |
| `authorization_validity_too_short` | Server rejected the signed authorization window | Check the system clock and the `validAfter`/`validBefore` calc in `x402_client.mjs` |
| Server offered no networks in our registry | Client and server disagree on supported chains | Compare `accepts` in 402 response against `scripts/chains.mjs` and add any missing chain |
| `Invalid price: $0.000000` | Upstream pricing bug | Still use x402 flow; report as upstream issue |
| Empty 200 response | Misleading success | Inspect response body, not just status code |
| Mnemonic not found | Env var not propagated to process | Run `node scripts/save-mnemonic.mjs --mnemonic "..."` to persist in `.env` |

After fixing any error, retry the original request once.

## Guardrails

- `/apis/v2/` = x402-paid. `/apis/v1/` = API-key. Never mix them.
- Never call `twitter/post_twitter` unless the user explicitly requests publishing.
- Never `transfer` USDC directly to the Gateway address — must use `deposit()`.
- Never deposit more USDC than the wallet's available ERC-20 balance.
- Prefer a capped `approve --cap <usdc>` over unlimited approval. The cap bounds how much the Gateway contract can pull from the wallet if it is ever compromised. Re-approving is cheap.
- Never quote prices from memory — always read `references/endpoint-catalog.md`.
- Mnemonic source priority: `OWS_MNEMONIC` env > `X402_MNEMONIC` env > local `.env` > `--mnemonic` flag.

## Files

| File | Purpose |
|------|---------|
| `scripts/check-env.sh` | Verify prerequisites, env vars, connectivity |
| `scripts/save-mnemonic.mjs` | Persist mnemonic to local `.env` |
| `scripts/chains.mjs` | Chain registry: 11 EVM mainnets + Arc Testnet (legacy). USDC/Gateway/RPC per chain. |
| `scripts/setup.mjs` | Balance check, ERC-20 approve, Gateway deposit (per chain via `--chain`, or all chains via `deposit-all`) |
| `scripts/x402_client.mjs` | Make paid x402 API requests; matches server `accepts` against the chain registry |
| `wallet.ows.json` | [OpenWallet Standard](https://docs.openwallet.sh/) `WalletDescriptor` listing the 11 EVM mainnet accounts. Capability declaration only; secret remains in `.env`. |
| `references/endpoint-catalog.md` | All 104 endpoints with prices — authoritative source |
| `references/earnings-press-releases-tickers.md` | Supported tickers for `/financial/earnings/press-releases` (2776 tickers) |
| `references/setup.md` | Environment and runtime notes |
| `references/troubleshooting.md` | Extended failure diagnostics |

## Resources

- [x402 Protocol](https://www.x402.org/) — HTTP payment standard
- [Open Wallet Standard](https://openwallet.sh/) — Local wallet management for agents
- [Circle Gateway](https://developers.circle.com/gateway/concepts/technical-guide) — Batched USDC settlement
- [aisa-proxy](https://github.com/AIsa-team/aisa-proxy) — Upstream AIsa x402 server (the `X402_CHAIN` config drives which networks `accepts` advertises)
- [AIsa API Docs](https://docs.aisa.one) — Full endpoint documentation
