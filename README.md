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

# 3. Fund the wallet with USDC + native gas on a supported chain (e.g. Base)

# 4. Approve + deposit into Circle Gateway on that chain (scripts auto-load .env)
node scripts/setup.mjs all --chain base --amount 10

# 5. Make a paid request (the client picks the right chain from the server's accepts list)
node scripts/x402_client.mjs GET "https://api.aisa.one/apis/v2/twitter/user/info?userName=jack" --chain base
```

Already have a mnemonic? Save it with `node scripts/save-mnemonic.mjs --mnemonic "your twelve word phrase"`.

### Supported chains

11 EVM mainnets accepted by AIsa, plus Arc Testnet (legacy — see Changelog):

`ethereum` `base` `avalanche` `arbitrum` `optimism` `polygon` `unichain` `sonic` `worldchain` `sei` `hyperevm`

Run `node scripts/setup.mjs chains` to list them with chain IDs and AIsa-acceptance status. Pick a chain via `--chain <key|id>` or set `OWS_CHAIN`. Per-chain RPCs default to public endpoints; override any of them with `OWS_RPC_<KEY>` (e.g. `OWS_RPC_BASE`).

### Multi-chain deposit

Fund a Gateway balance in one shot across every AIsa-accepted chain that has USDC + native gas:

```bash
# Plan only — print which chains will deposit, no transactions sent.
node scripts/setup.mjs deposit-all --amount 5

# Execute — deposit 5 USDC on every chain that can.
node scripts/setup.mjs deposit-all --amount 5 --cap 50 --execute
```

Behavior: dry-run by default; `--amount` is required (no implicit default); chains with insufficient USDC or zero native gas are skipped; chains with `allowance < amount` get an `approve` first (capped at `--cap` if provided, else unlimited). Mainnet — confirm the plan before passing `--execute`.

### Gasless deposit (no native gas required) — via Eco

If the wallet has USDC on Base / OP / Arbitrum but no native ETH on that chain, use [Eco's programmable-address service](https://eco.com/docs/getting-started/programmable-addresses/gateway-deposits) to deposit gaslessly. The user signs a USDC ERC-3009 `transferWithAuthorization`; Eco's deposit-address service eats source-chain gas, routes via CCTP, and credits the user's Circle Gateway balance on Polygon. AIsa accepts payments from Polygon Gateway (`eip155:137`).

```bash
# Plan: generates the Eco deposit address, shows the destination, no signing.
node scripts/deposit-via-eco.mjs --amount 5 --source base

# Test against Eco's preproduction (Base Sepolia → Polygon Amoy):
node scripts/deposit-via-eco.mjs --amount 5 --source baseSepolia --env preproduction --execute

# Execute on mainnet (real USDC):
node scripts/deposit-via-eco.mjs --amount 5 --source base --execute
```

Constraints: source chains limited to `base`, `optimism`, `arbitrum` (mainnet) or their Sepolias (preproduction). Destination is Polygon Gateway only. For other source chains, fall back to direct `setup.mjs deposit --chain <key>` (requires native gas). Adds a hard dependency on `deposit-addresses.eco.com` for the duration of the deposit; failed intents are refunded by an independent permissionless service after ~4 hours.

### Wallet descriptor

[`wallet.ows.json`](./wallet.ows.json) is an [OpenWallet Standard](https://docs.openwallet.sh/) `WalletDescriptor` declaring the 11 EVM mainnet accounts this wallet uses. It's a *capability declaration*, not a full OWS vault — the mnemonic still lives in `.env` (`OWS_MNEMONIC`), and the OWS-required `crypto` block is intentionally omitted. To upgrade to a real encrypted vault under `~/.ows/`, install [`@open-wallet-standard/core`](https://www.npmjs.com/package/@open-wallet-standard/core) and import the mnemonic — see the [storage spec](https://docs.openwallet.sh/doc.html?slug=01-storage-format).

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
| Chains | 11 EVM mainnets (Ethereum, Base, Avalanche, Arbitrum, OP, Polygon, Unichain, Sonic, World Chain, Sei, HyperEVM) + Arc Testnet (legacy) |
| Gateway Wallet (mainnet) | `0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE` (same on every chain) |
| Gateway Wallet (Arc Testnet) | `0x0077777d7EBA4688BDeF3E311b846F25870A19B9` |
| Per-chain USDC + RPC | See [`scripts/chains.mjs`](./scripts/chains.mjs) |
| API Base URL | `https://api.aisa.one/apis/v2/` |

## Documentation

- **[SKILL.md](./SKILL.md)** — Full agent instructions, decision flow, examples, error handling, and guardrails
- **[references/endpoint-catalog.md](./references/endpoint-catalog.md)** — Complete priced catalog of all 104 endpoints
- **[references/troubleshooting.md](./references/troubleshooting.md)** — Extended failure diagnostics
- **[references/setup.md](./references/setup.md)** — Environment and runtime notes

## Changelog

- **2026-04-30 — v0.2.0** — Multi-chain support: scripts now drive 11 EVM mainnets (Ethereum, Base, Avalanche, Arbitrum, OP, Polygon, Unichain, Sonic, World Chain, Sei, HyperEVM) via `scripts/chains.mjs`. Arc Testnet remains in the registry but is no longer accepted by AIsa for paid endpoints. Added `wallet.ows.json` (OWS-shaped wallet descriptor declaring all 11 accounts) and `setup.mjs deposit-all` for orchestrated multi-chain deposits.

  **Breaking changes:**
  - `--chain <key|id>` flag is now required for `setup.mjs approve | deposit | all` (or set `OWS_CHAIN` env). No default — mainnet is real money.
  - `OWS_CHAIN_ID` env var (numeric chain ID) removed; replaced by `OWS_CHAIN` (registry key, e.g. `base`).
  - `npm run setup` no longer runs `setup all` implicitly — it shows the help text. Use `npm run setup -- all --chain <key>` or call `node scripts/setup.mjs` directly.
  - `npm run approve` and `npm run deposit` removed; call them directly with `--chain`.
  - `npm run balance` now shows balances across every chain (`balance --all`).
- **2026-04-20** — Added 21 CoinGecko endpoints ($0.008/call) and expanded the total from 83 to 104 endpoints across 7 categories.
- **2026-04-16** — As part of the initiative supporting Agentic Economy on Arc hackathon, AIsa supports Arc testnet transactions until April 26, 2026 PT.

## Resources

- [x402 Protocol](https://www.x402.org/) — HTTP payment standard
- [Open Wallet Standard](https://openwallet.sh/) — Local wallet management for agents
- [Circle Gateway](https://developers.circle.com/gateway/concepts/technical-guide) — Batched USDC settlement
- [Arc Testnet](https://docs.arc.network/) — Circle's EVM L1 with native USDC
- [AIsa API Docs](https://aisa.one/docs/api-reference) — Full endpoint documentation. Note: the docs' interactive "Try it" feature requires an API key (the x402 flow in this skill does not).
