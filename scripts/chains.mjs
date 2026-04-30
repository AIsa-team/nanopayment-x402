/**
 * Chain registry for x402 / Circle Gateway.
 *
 * 11 EVM mainnets accepted by AIsa (api.aisa.one) + Arc Testnet (legacy, no longer
 * accepted for AIsa payments — kept for local dev / historical wallets).
 *
 * Sources:
 *   - Gateway addresses: ~/.agents/skills/use-gateway/SKILL.md
 *   - USDC addresses + AIsa-accepted networks: live `accepts` payload from
 *     https://api.aisa.one/apis/v2/twitter/user/info?userName=jack (HTTP 402)
 *   - Default RPCs: chain operators' public endpoints (rate-limited; override
 *     via OWS_RPC_<KEY> env var, e.g. OWS_RPC_BASE)
 */

// Gateway Wallet ("verifyingContract" in EIP-712 domain) — same address on every
// EVM mainnet. Different (testnet) address on Arc Testnet.
export const GATEWAY_WALLET_MAINNET = "0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE";
export const GATEWAY_WALLET_TESTNET = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9";

export const CHAINS = {
  ethereum: {
    key: "ethereum",
    id: 1,
    name: "Ethereum",
    network: "eip155:1",
    defaultRpc: "https://ethereum-rpc.publicnode.com",
    usdc: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    gatewayWallet: GATEWAY_WALLET_MAINNET,
    native: { name: "Ether", symbol: "ETH", decimals: 18 },
    aisaAccepted: true,
    testnet: false,
  },
  base: {
    key: "base",
    id: 8453,
    name: "Base",
    network: "eip155:8453",
    defaultRpc: "https://mainnet.base.org",
    usdc: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    gatewayWallet: GATEWAY_WALLET_MAINNET,
    native: { name: "Ether", symbol: "ETH", decimals: 18 },
    aisaAccepted: true,
    testnet: false,
  },
  avalanche: {
    key: "avalanche",
    id: 43114,
    name: "Avalanche",
    network: "eip155:43114",
    defaultRpc: "https://api.avax.network/ext/bc/C/rpc",
    usdc: "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e",
    gatewayWallet: GATEWAY_WALLET_MAINNET,
    native: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
    aisaAccepted: true,
    testnet: false,
  },
  arbitrum: {
    key: "arbitrum",
    id: 42161,
    name: "Arbitrum One",
    network: "eip155:42161",
    defaultRpc: "https://arb1.arbitrum.io/rpc",
    usdc: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
    gatewayWallet: GATEWAY_WALLET_MAINNET,
    native: { name: "Ether", symbol: "ETH", decimals: 18 },
    aisaAccepted: true,
    testnet: false,
  },
  optimism: {
    key: "optimism",
    id: 10,
    name: "OP Mainnet",
    network: "eip155:10",
    defaultRpc: "https://mainnet.optimism.io",
    usdc: "0x0b2c639c533813f4aa9d7837caf62653d097ff85",
    gatewayWallet: GATEWAY_WALLET_MAINNET,
    native: { name: "Ether", symbol: "ETH", decimals: 18 },
    aisaAccepted: true,
    testnet: false,
  },
  polygon: {
    key: "polygon",
    id: 137,
    name: "Polygon PoS",
    network: "eip155:137",
    defaultRpc: "https://polygon-bor-rpc.publicnode.com",
    usdc: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
    gatewayWallet: GATEWAY_WALLET_MAINNET,
    native: { name: "POL", symbol: "POL", decimals: 18 },
    aisaAccepted: true,
    testnet: false,
  },
  unichain: {
    key: "unichain",
    id: 130,
    name: "Unichain",
    network: "eip155:130",
    defaultRpc: "https://mainnet.unichain.org",
    usdc: "0x078d782b760474a361dda0af3839290b0ef57ad6",
    gatewayWallet: GATEWAY_WALLET_MAINNET,
    native: { name: "Ether", symbol: "ETH", decimals: 18 },
    aisaAccepted: true,
    testnet: false,
  },
  sonic: {
    key: "sonic",
    id: 146,
    name: "Sonic",
    network: "eip155:146",
    defaultRpc: "https://rpc.soniclabs.com",
    usdc: "0x29219dd400f2bf60e5a23d13be72b486d4038894",
    gatewayWallet: GATEWAY_WALLET_MAINNET,
    native: { name: "Sonic", symbol: "S", decimals: 18 },
    aisaAccepted: true,
    testnet: false,
  },
  worldchain: {
    key: "worldchain",
    id: 480,
    name: "World Chain",
    network: "eip155:480",
    defaultRpc: "https://worldchain-mainnet.g.alchemy.com/public",
    usdc: "0x79a02482a880bce3f13e09da970dc34db4cd24d1",
    gatewayWallet: GATEWAY_WALLET_MAINNET,
    native: { name: "Ether", symbol: "ETH", decimals: 18 },
    aisaAccepted: true,
    testnet: false,
  },
  sei: {
    key: "sei",
    id: 1329,
    name: "Sei",
    network: "eip155:1329",
    defaultRpc: "https://evm-rpc.sei-apis.com",
    usdc: "0xe15fc38f6d8c56af07bbcbe3baf5708a2bf42392",
    gatewayWallet: GATEWAY_WALLET_MAINNET,
    native: { name: "Sei", symbol: "SEI", decimals: 18 },
    aisaAccepted: true,
    testnet: false,
  },
  hyperevm: {
    key: "hyperevm",
    id: 999,
    name: "HyperEVM",
    network: "eip155:999",
    defaultRpc: "https://rpc.hyperliquid.xyz/evm",
    usdc: "0xb88339cb7199b77e23db6e890353e22632ba630f",
    gatewayWallet: GATEWAY_WALLET_MAINNET,
    native: { name: "HYPE", symbol: "HYPE", decimals: 18 },
    aisaAccepted: true,
    testnet: false,
  },
  // Legacy: AIsa stopped accepting Arc Testnet payments after 2026-04-26.
  // Kept here so historical wallets can still be inspected / migrated.
  arcTestnet: {
    key: "arcTestnet",
    id: 5042002,
    name: "Arc Testnet",
    network: "eip155:5042002",
    defaultRpc: "https://rpc.testnet.arc.network",
    usdc: "0x3600000000000000000000000000000000000000",
    gatewayWallet: GATEWAY_WALLET_TESTNET,
    // Arc uses USDC as the native gas token (18 decimals).
    native: { name: "USDC", symbol: "USDC", decimals: 18 },
    aisaAccepted: false,
    testnet: true,
  },
};

export const MAINNET_KEYS = Object.values(CHAINS)
  .filter((c) => !c.testnet)
  .map((c) => c.key);

export const AISA_ACCEPTED_KEYS = Object.values(CHAINS)
  .filter((c) => c.aisaAccepted)
  .map((c) => c.key);

/**
 * Resolve a chain by key (e.g. "base"), id (e.g. 8453), or eip155 network string.
 * Returns the registry entry with `rpc` overridden by env if set.
 *
 * Per-chain RPC overrides via env:
 *   OWS_RPC_<UPPER_KEY>   e.g. OWS_RPC_BASE, OWS_RPC_ETHEREUM
 *   OWS_RPC_URL           legacy global override (applies to selected chain only)
 */
export function getChain(selector) {
  if (selector == null) return null;

  let entry = null;
  if (typeof selector === "string") {
    if (CHAINS[selector]) entry = CHAINS[selector];
    else {
      const network = selector.startsWith("eip155:") ? selector : null;
      const id = network ? parseInt(network.split(":")[1]) : parseInt(selector);
      if (!Number.isNaN(id)) {
        entry = Object.values(CHAINS).find((c) => c.id === id) || null;
      }
    }
  } else if (typeof selector === "number") {
    entry = Object.values(CHAINS).find((c) => c.id === selector) || null;
  }

  if (!entry) return null;

  const envKey = `OWS_RPC_${entry.key.toUpperCase()}`;
  const rpc = process.env[envKey] || process.env.OWS_RPC_URL || entry.defaultRpc;
  return { ...entry, rpc };
}

/** viem chain definition for a registry entry. */
export function toViemChain(chain) {
  return {
    id: chain.id,
    name: chain.name,
    nativeCurrency: chain.native,
    rpcUrls: { default: { http: [chain.rpc] } },
  };
}

export function listChains({ includeTestnet = true } = {}) {
  return Object.values(CHAINS).filter((c) => includeTestnet || !c.testnet);
}
