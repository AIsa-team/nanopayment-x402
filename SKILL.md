---
name: arc-x402
description: Access AIsa x402-paid /apis/v2/ endpoints using Arc testnet USDC and Circle Gateway. Use when setting up x402 payments, creating or funding an Arc wallet, depositing into Circle Gateway, picking the right AIsa endpoint for a task, estimating per-call cost, or making paid AIsa API calls without an API key. 102 endpoints across Twitter, Financial, Search, Scholar, Perplexity, YouTube, and CoinGecko categories.
---

# arc-x402

Pay-per-call API access to 79 AIsa endpoints via the x402 HTTP payment protocol. No API key needed — pays with USDC on Arc testnet via Circle Gateway.

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
| Chain | Arc Testnet (`5042002`) |
| RPC | `https://rpc.testnet.arc.network` |
| Explorer | https://testnet.arcscan.app/ |
| Faucet | https://faucet.circle.com/ |
| USDC Token | `0x3600000000000000000000000000000000000000` |
| USDC Decimals | 6 (ERC-20 token), 18 (native gas) |
| Gateway | `0x0077777d7eba4688bdef3e311b846f25870a19b9` |
| Endpoint catalog | `references/endpoint-catalog.md` |
| API Path Prefix | `/apis/v2/` (x402) vs `/apis/v1/` (API key) |

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

**Warning: Circle Faucet is protected by reCAPTCHA — do NOT use browser automation tools (Claude in Chrome, Puppeteer, etc.) to interact with the faucet page. They will fail on the captcha.**

Get the wallet address:
```bash
node scripts/setup.mjs address
```

Then display the wallet address prominently and open the faucet with the address pre-filled:

1. **Show the wallet address** — display it in a formatted code block so the user can easily copy it:
   ```
   Your new wallet address (click to copy):

   `0x<WALLET_ADDRESS>`

   Fund this wallet with testnet USDC to get started.
   Opening the Circle Faucet now...
   ```

2. **Open the faucet and pre-fill the address** — use Claude in Chrome to navigate to the faucet and fill the wallet address field:
   ```
   tabs_context_mcp (createIfEmpty: true)   → get/create tab group
   tabs_create_mcp                          → create a new tab
   navigate (url: "https://faucet.circle.com", tabId: <new_tab>)
   ```
   Wait for the page to load, then find and fill the address input:
   ```
   find (query: "wallet address input", tabId: <tab>)
   form_input (ref: <address_input_ref>, value: "<WALLET_ADDRESS>", tabId: <tab>)
   ```

3. **Tell the user** to complete the remaining steps in the browser tab:
   - Select **Arc Testnet** as the network
   - Complete the reCAPTCHA
   - Click **Send 20 USDC**

   **⚠️ Do NOT use browser automation for the reCAPTCHA or submit button — only pre-fill the address field.**

Wait for the user to confirm they have completed the faucet claim, then verify the balance:

```bash
node scripts/setup.mjs balance
```

If ERC-20 USDC is still `0`, the faucet claim may not have gone through — ask the user to try again.

Once funded, continue to step 3 to approve and deposit into the Gateway.

### 3. Check Balance and Auto-Deposit

```bash
node scripts/setup.mjs balance
```

Parse the output. Then apply these rules in order:

| Condition | Action |
|-----------|--------|
| Gateway allowance is `0` | Run `node scripts/setup.mjs approve` first |
| Gateway deposit < 0.5 USDC AND wallet ERC-20 USDC >= 5 | Run `node scripts/setup.mjs deposit --amount 5` (no user confirmation needed) |
| Gateway deposit < 0.5 USDC AND wallet ERC-20 USDC < 5 | Get the wallet address via `node scripts/setup.mjs address`. Display it in a code block for easy copying. Then open the faucet and pre-fill the address using Claude in Chrome: `tabs_context_mcp` → `tabs_create_mcp` → `navigate` to `https://faucet.circle.com` → `find` the address input → `form_input` to fill the wallet address. Tell the user to select **Arc Testnet**, complete the reCAPTCHA, and click **Send 20 USDC**. Do NOT automate the reCAPTCHA or submit button. Wait for user confirmation, then re-run `node scripts/setup.mjs balance` to verify funds arrived. |
| Gateway deposit >= 0.5 USDC | Proceed |

> **Warning:** Do NOT directly transfer USDC to the Gateway address. You must call `deposit()` or the funds will be lost.

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
node scripts/x402_client.mjs <METHOD> "<full_url>" [--body '<json>']
```

POST endpoints with no body still need `--body '{}'`.

Output: JSON on stdout, status info on stderr. Parse stdout for the API response.

### 6. View Transaction History

When the user asks for transaction history, wallet activity, or spending summary, compile both on-chain and off-chain (x402 API) activity:

**On-chain transactions:**

1. Get the transaction count:
```bash
curl -s -X POST https://rpc.testnet.arc.network \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_getTransactionCount","params":["<WALLET_ADDRESS>","latest"]}'
```

2. For each known transaction hash (from approve/deposit operations earlier in the session), fetch the receipt:
```bash
curl -s -X POST https://rpc.testnet.arc.network \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_getTransactionReceipt","params":["<TX_HASH>"]}'
```

Extract from each receipt: `transactionHash`, `blockNumber` (hex→decimal), `status` (`0x1`=Success), `gasUsed` (hex→decimal), and `to` address. Known contracts:
- `0x3600000000000000000000000000000000000000` — USDC Token (approve txs)
- `0x0077777d7eba4688bdef3e311b846f25870a19b9` — Gateway (deposit txs)

**Off-chain x402 API calls:** Track all x402 API calls made during the session. For each call, record the endpoint name, path, and per-call cost (from `references/endpoint-catalog.md`). Sum the total API spend.

**Current balance:**

```bash
node scripts/setup.mjs balance
```

This shows ERC-20 USDC in wallet, Gateway allowance, and remaining Gateway deposit.

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
| 403 + `"Pre-deduction failed"` | Insufficient Gateway deposit | Run step 3 (balance check + auto-deposit) |
| `invalid_signature` | Wrong EIP-712 verifyingContract | Already handled by `x402_client.mjs` — if still failing, check `extra.verifyingContract` in 402 response |
| `insufficient_balance` | No USDC deposited in Gateway | `node scripts/setup.mjs deposit --amount 5` |
| `Invalid price: $0.000000` | Upstream pricing bug | Still use x402 flow; report as upstream issue |
| Empty 200 response | Misleading success | Inspect response body, not just status code |
| Mnemonic not found | Env var not propagated to process | Run `node scripts/save-mnemonic.mjs --mnemonic "..."` to persist in `.env` |
| `UnsupportedChain` (ows CLI) | Known OWS issue with testnet chain IDs | Use the JS client instead of `ows pay request` |

After fixing any error, retry the original request once.

## Guardrails

- `/apis/v2/` = x402-paid. `/apis/v1/` = API-key. Never mix them.
- Never call `twitter/post_twitter` unless the user explicitly requests publishing.
- Never `transfer` USDC directly to the Gateway address — must use `deposit()`.
- Never deposit more USDC than the wallet's available ERC-20 balance.
- Never quote prices from memory — always read `references/endpoint-catalog.md`.
- Mnemonic source priority: `OWS_MNEMONIC` env > `X402_MNEMONIC` env > local `.env` > `--mnemonic` flag.

## Files

| File | Purpose |
|------|---------|
| `scripts/check-env.sh` | Verify prerequisites, env vars, connectivity |
| `scripts/save-mnemonic.mjs` | Persist mnemonic to local `.env` |
| `scripts/setup.mjs` | Balance check, ERC-20 approve, Gateway deposit |
| `scripts/x402_client.mjs` | Make paid x402 API requests |
| `references/endpoint-catalog.md` | All 102 endpoints with prices — authoritative source |
| `references/earnings-press-releases-tickers.md` | Supported tickers for `/financial/earnings/press-releases` (2776 tickers) |
| `references/setup.md` | Environment and runtime notes |
| `references/troubleshooting.md` | Extended failure diagnostics |

## Resources

- [x402 Protocol](https://www.x402.org/) — HTTP payment standard
- [Open Wallet Standard](https://openwallet.sh/) — Local wallet management for agents
- [Circle Gateway](https://developers.circle.com/gateway/concepts/technical-guide) — Batched USDC settlement
- [Arc Testnet](https://docs.arc.network/) — Circle's EVM L1 with native USDC
- [AIsa API Docs](https://docs.aisa.one) — Full endpoint documentation
