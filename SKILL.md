---
name: arc-x402
description: Access AIsa x402-paid /apis/v2/ endpoints using Arc testnet USDC and Circle Gateway. Use when setting up x402 payments, creating or funding an Arc wallet, depositing into Circle Gateway, picking the right AIsa endpoint for a task, estimating per-call cost, or making paid AIsa API calls without an API key. 79 endpoints across Twitter, Financial, Search, Scholar, Perplexity, and YouTube categories.
---

# arc-x402

Pay-per-call API access to 79 AIsa endpoints via the x402 HTTP payment protocol. No API key needed — pays with USDC on Arc testnet via Circle Gateway.

## Quick Reference

| Item | Value |
|------|-------|
| API Base | `https://api.aisa.one/apis/v2/` |
| Chain | Arc Testnet (`5042002`) |
| RPC | `https://rpc.testnet.arc.network` |
| USDC Token | `0x3600000000000000000000000000000000000000` |
| Gateway | `0x0077777d7eba4688bdef3e311b846f25870a19b9` |
| Faucet | https://faucet.circle.com/ |
| Endpoint catalog | `references/endpoint-catalog.md` |

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

**If no mnemonic found**, automatically create a wallet and start the funding flow:

```bash
npx --yes @open-wallet-standard/core wallet create --name x402-agent --show-mnemonic
```

Save the mnemonic from the output to the local `.env`:
```bash
node scripts/save-mnemonic.mjs --wallet x402-agent
```

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

### 4. Look Up Endpoint

**Before every API call**, look up the endpoint in `references/endpoint-catalog.md`. Extract:
- Exact path and HTTP method
- Per-call price in USD
- Required parameters and caveats

**Cost confirmation rule**: If price >= $0.036/call, confirm with the user before calling. Expensive endpoints:
- `twitter/user/followers` ($0.036)
- `twitter/user/followings` ($0.036)
- `financial/analyst-estimates` ($0.120)
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

### 6. Transaction History

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

Extract from each receipt: `transactionHash`, `blockNumber` (hex→decimal), `status` (`0x1`=Success), `gasUsed` (hex→decimal), and `to` address. Label the `to` address as "USDC Token" if it matches `0x3600000000000000000000000000000000000000` or "Gateway" if it matches `0x0077777d7eba4688bdef3e311b846f25870a19b9`.

**Off-chain x402 API calls:**

Track all x402 API calls made during the session. For each call, record the endpoint name, path, and per-call cost (from `references/endpoint-catalog.md`). Sum the total API spend.

**Current balance:**

```bash
node scripts/setup.mjs balance
```

**Present the results as three tables:**
1. **On-Chain Transactions** — hash, block, action (Approve/Deposit), target contract, gas used, status
2. **x402 API Calls** — endpoint name, cost per call
3. **Current Balance** — ERC-20 USDC in wallet, remaining Gateway deposit, total available

## Endpoint Parameter Caveats

| Endpoint group | Caveat |
|----------------|--------|
| Twitter user endpoints | Use `userName`, NOT `screen_name` |
| Polymarket/Kalshi search | Require `status=open\|closed` with `search` param |
| Perplexity endpoints | Require `model` in JSON body (e.g. `"model":"sonar"`) |
| YouTube search | Require both `q` and `engine=youtube` |
| `scholar/search/explain` | Follow-up call; requires `search_id` in body |
| `matching-markets/sports` | Requires `kalshi_ticker` or `polymarket_market_slug` |

## Error Handling

| Error / Status | Diagnosis | Fix |
|----------------|-----------|-----|
| 403 + `"Pre-deduction failed"` | Insufficient Gateway deposit | Run step 3 (balance check + auto-deposit) |
| `invalid_signature` | Wrong EIP-712 verifyingContract | Already handled by `x402_client.mjs` — if still failing, check `extra.verifyingContract` in 402 response |
| `insufficient_balance` | No USDC deposited in Gateway | `node scripts/setup.mjs deposit --amount 5` |
| `Invalid price: $0.000000` | Upstream pricing bug | Still use x402 flow; report as upstream issue |
| Empty 200 response | Misleading success | Inspect response body, not just status code |
| Mnemonic not found | Env var not propagated to process | Run `node scripts/save-mnemonic.mjs --mnemonic "..."` to persist in `.env` |

After fixing any error, retry the original request once.

## Guardrails

- `/apis/v2/` = x402-paid. `/apis/v1/` = API-key. Never mix them.
- Never call `twitter/post_twitter` unless the user explicitly requests publishing.
- Never `transfer` USDC directly to the Gateway address — must use `deposit()`.
- Never deposit more USDC than the wallet's available ERC-20 balance.
- Never quote prices from memory — always read `references/endpoint-catalog.md`.
- Mnemonic source priority: `OWS_MNEMONIC` > `X402_MNEMONIC` > local `.env` > `--mnemonic-env` > `--mnemonic`.

## Files

| File | Purpose |
|------|---------|
| `scripts/check-env.sh` | Verify prerequisites, env vars, connectivity |
| `scripts/save-mnemonic.mjs` | Persist mnemonic to local `.env` |
| `scripts/setup.mjs` | Balance check, ERC-20 approve, Gateway deposit |
| `scripts/x402_client.mjs` | Make paid x402 API requests |
| `references/endpoint-catalog.md` | All 79 endpoints with prices — authoritative source |
| `references/setup.md` | Environment and runtime notes |
| `references/troubleshooting.md` | Extended failure diagnostics |
