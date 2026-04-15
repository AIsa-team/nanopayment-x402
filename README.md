# x402 Payment Skill

Pay-per-call API access to AIsa endpoints using the [x402](https://www.x402.org/) HTTP payment protocol. No API key needed — pay with USDC on [Arc testnet](https://testnet.arcscan.app/) via [Circle Gateway](https://www.circle.com/gateway).

**79 endpoints** across Twitter, Financial, Search, Scholar, Perplexity, and YouTube. Prices range from $0.00044 to $0.12 per call.

## How It Works

```
Agent --> AIsa API (HTTP 402) --> Agent signs EIP-712 payment --> API returns data
                                         |
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
- **[references/endpoint-catalog.md](./references/endpoint-catalog.md)** — Complete priced catalog of all 79 endpoints
- **[references/troubleshooting.md](./references/troubleshooting.md)** — Extended failure diagnostics
- **[references/setup.md](./references/setup.md)** — Environment and runtime notes

## Resources

- [x402 Protocol](https://www.x402.org/) — HTTP payment standard
- [Open Wallet Standard](https://openwallet.sh/) — Local wallet management for agents
- [Circle Gateway](https://developers.circle.com/gateway/concepts/technical-guide) — Batched USDC settlement
- [Arc Testnet](https://docs.arc.network/) — Circle's EVM L1 with native USDC
- [AIsa API Docs](https://docs.aisa.one) — Full endpoint documentation
