---
name: arc-x402
description: Access AIsa x402-paid /apis/v2/ endpoints using Arc testnet USDC and Circle Gateway. Use when setting up x402 payments, creating or funding an Arc wallet, depositing into Circle Gateway, picking the right AIsa endpoint for a task, estimating per-call cost, or making paid AIsa API calls without an API key.
---

# arc-x402

Pay-per-call API access to 80 AIsa endpoints via the x402 HTTP payment protocol. No API key needed — pays with USDC on Arc testnet via Circle Gateway.

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

**If no mnemonic found**:
```bash
ows wallet create --name my-agent --show-mnemonic
node scripts/save-mnemonic.mjs --mnemonic "<mnemonic from output>"
```
Then tell the user to fund the wallet at https://faucet.circle.com/ with their EVM address on Arc Testnet.

### 3. Check Balance and Auto-Deposit

```bash
node scripts/setup.mjs balance
```

Parse the output. Then apply these rules in order:

| Condition | Action |
|-----------|--------|
| Gateway allowance is `0` | Run `node scripts/setup.mjs approve` first |
| Gateway deposit < 0.5 USDC AND wallet ERC-20 USDC >= 5 | Run `node scripts/setup.mjs deposit --amount 5` (no user confirmation needed) |
| Gateway deposit < 0.5 USDC AND wallet ERC-20 USDC < 5 | Tell user to claim USDC from https://faucet.circle.com/ |
| Gateway deposit >= 0.5 USDC | Proceed |

### 4. Look Up Endpoint

**Before every API call**, look up the endpoint in `references/endpoint-catalog.md`. Extract:
- Exact path and HTTP method
- Per-call price in USD
- Required parameters and caveats

**Cost confirmation rule**: If price >= $0.036/call, confirm with the user before calling. Expensive endpoints:
- `twitter/user/followers` ($0.036)
- `twitter/user/followings` ($0.036)
- `financial/analyst-estimates` ($0.048)
- `financial/earnings/press-releases` ($0.048)
- `financial/financials/income-statements` ($0.048)
- `financial/financials/balance-sheets` ($0.048)
- `financial/financials/cash-flow-statements` ($0.048)
- `financial/financials` ($0.120) — prefer individual statement endpoints at $0.048 unless user needs all three

**Loop cost rule**: Before looping calls, calculate `count * price` and tell the user the total estimated cost. Wait for confirmation.

### 5. Make the Request

```bash
node scripts/x402_client.mjs <METHOD> "<full_url>" [--body '<json>']
```

POST endpoints with no body still need `--body '{}'`.

Output: JSON on stdout, status info on stderr. Parse stdout for the API response.

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
| `references/endpoint-catalog.md` | All 80 endpoints with prices — authoritative source |
| `references/setup.md` | Environment and runtime notes |
| `references/troubleshooting.md` | Extended failure diagnostics |
