# x402 Payment Skill

Pay-per-call API access to AIsa endpoints using the [x402](https://www.x402.org/) HTTP nanopayment protocol across multiple chains. No API key needed — pay with USDC via [Circle Gateway](https://www.circle.com/gateway).

**104 endpoints** across Twitter, Financial, Search, Scholar, Perplexity, YouTube, and CoinGecko. Prices range from $0.00044 to $0.12 per call.

## How It Works

```
Agent --> AIsa API (HTTP 402) --> Agent signs EIP-712 payment --> API returns data
                                         |
                               Circle Gateway (batched USDC settlement)
```

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Create a wallet (generates a BIP-39 mnemonic via viem and saves to .env)
node --input-type=module -e "
import { generateMnemonic, english, mnemonicToAccount } from 'viem/accounts';
import fs from 'fs';
const mnemonic = generateMnemonic(english);
fs.writeFileSync('.env', 'OWS_MNEMONIC=' + mnemonic + '\n');
console.log('Address:', mnemonicToAccount(mnemonic).address);
"

# 3. Fund with testnet USDC from https://faucet.circle.com/ (select Arc Testnet)

# 4. Deposit into Circle Gateway (scripts auto-load .env)
node scripts/setup.mjs all       # approve + deposit 10 USDC

# 5. Make a paid request
node scripts/x402_client.mjs GET "https://api.aisa.one/apis/v2/twitter/user/info?userName=jack"
```

Already have a mnemonic? Save it with `node scripts/save-mnemonic.mjs --mnemonic "your twelve word phrase"`.

### Examples

```bash
# Scripts auto-load OWS_MNEMONIC from .env in the current directory.

# Twitter user info (use userName, not screen_name)
node scripts/x402_client.mjs GET "https://api.aisa.one/apis/v2/twitter/user/info?userName=jack"

# Scholar search (POST endpoints need --body '{}')
node scripts/x402_client.mjs POST "https://api.aisa.one/apis/v2/scholar/search/scholar?query=AI" --body '{}'

# Perplexity (model is required in the JSON body)
node scripts/x402_client.mjs POST "https://api.aisa.one/apis/v2/perplexity/sonar" \
  --body '{"model":"sonar","messages":[{"role":"user","content":"What is Bitcoin? Keep it brief."}]}'
```

For programmatic use in Node.js, import the `createPayingFetch` function from `scripts/x402_client.mjs`.

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
- **[references/endpoint-catalog.md](./references/endpoint-catalog.md)** — Complete priced catalog of all 104 endpoints
- **[references/troubleshooting.md](./references/troubleshooting.md)** — Extended failure diagnostics
- **[references/setup.md](./references/setup.md)** — Environment and runtime notes

## Changelog

- **2026-04-20** — Added 21 CoinGecko endpoints ($0.008/call) and expanded the total from 83 to 104 endpoints across 7 categories.
- **2026-04-16** — As part of the initiative supporting Agentic Economy on Arc hackathon, AIsa supports Arc testnet transactions until April 26, 2026 PT.

## Resources

- [x402 Protocol](https://www.x402.org/) — HTTP payment standard
- [Open Wallet Standard](https://openwallet.sh/) — Local wallet management for agents
- [Circle Gateway](https://developers.circle.com/gateway/concepts/technical-guide) — Batched USDC settlement
- [Arc Testnet](https://docs.arc.network/) — Circle's EVM L1 with native USDC
- [AIsa API Docs](https://aisa.one/docs/api-reference) — Full endpoint documentation. Note: the docs' interactive "Try it" feature requires an API key (the x402 flow in this skill does not).
