#!/usr/bin/env node
/**
 * x402 Payment Client — pay-per-call API requests via Circle Gateway.
 *
 * Supports any chain in scripts/chains.mjs. The server's HTTP 402 response
 * lists `accepts` networks; the client picks the highest-priority match
 * against the local registry.
 *
 * Usage:
 *   node x402_client.mjs <method> <url> [--body <json>] [--mnemonic <phrase>] [--chain <key>]
 *
 * Examples:
 *   node x402_client.mjs POST "https://api.aisa.one/apis/v2/scholar/search/scholar?query=AI" --body '{}'
 *   node x402_client.mjs GET  "https://api.aisa.one/apis/v2/polymarket/markets?search=election" --chain base
 *
 * Environment:
 *   OWS_MNEMONIC   BIP-39 mnemonic for the paying wallet (or use --mnemonic)
 *   OWS_CHAIN      Preferred chain key (e.g. "base") — used if server offers it
 *   OWS_RPC_<KEY>  Per-chain RPC override (e.g. OWS_RPC_BASE)
 */

import fs from "fs";
import path from "path";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { toClientEvmSigner } from "@x402/evm";
import { createWalletClient, createPublicClient, http, getAddress } from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { CHAINS, getChain, listChains, toViemChain } from "./chains.mjs";

// ---------------------------------------------------------------------------
// .env loader
// ---------------------------------------------------------------------------

const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, "utf8");
  for (const line of envText.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

// All eip155 networks the local registry knows about — used to register
// schemes with the x402 client. The server may offer any subset.
const SUPPORTED_NETWORKS = listChains().map((c) => c.network);

// ---------------------------------------------------------------------------
// GatewayEvmScheme — signs x402 payments using Circle Gateway's EIP-712 domain
// ---------------------------------------------------------------------------

class GatewayEvmScheme {
  constructor(signer) {
    this.signer = signer;
    this.scheme = "exact";
  }

  async createPaymentPayload(x402Version, paymentRequirements) {
    const nonce =
      "0x" +
      [...crypto.getRandomValues(new Uint8Array(32))]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    const now = Math.floor(Date.now() / 1000);

    const authorization = {
      from: this.signer.address,
      to: getAddress(paymentRequirements.payTo),
      value: paymentRequirements.amount,
      validAfter: (now - 600).toString(),
      validBefore: (now + paymentRequirements.maxTimeoutSeconds).toString(),
      nonce,
    };

    const chainIdMatch = paymentRequirements.network.match(/eip155:(\d+)/);
    const chainId = chainIdMatch ? parseInt(chainIdMatch[1]) : null;
    if (chainId == null) {
      throw new Error(`Cannot parse chainId from network: ${paymentRequirements.network}`);
    }

    // Circle Gateway: use extra.verifyingContract, NOT the asset address
    const domain = {
      name: paymentRequirements.extra?.name || "GatewayWalletBatched",
      version: paymentRequirements.extra?.version || "1",
      chainId,
      verifyingContract: paymentRequirements.extra?.verifyingContract
        ? getAddress(paymentRequirements.extra.verifyingContract)
        : getAddress(paymentRequirements.asset),
    };

    const types = {
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    };

    const message = {
      from: getAddress(authorization.from),
      to: getAddress(authorization.to),
      value: BigInt(authorization.value),
      validAfter: BigInt(authorization.validAfter),
      validBefore: BigInt(authorization.validBefore),
      nonce: authorization.nonce,
    };

    const signature = await this.signer.signTypedData({
      domain,
      types,
      primaryType: "TransferWithAuthorization",
      message,
    });

    return { x402Version, payload: { authorization, signature } };
  }
}

// ---------------------------------------------------------------------------
// Build paying fetch
// ---------------------------------------------------------------------------

/**
 * options.preferredChainKey — registry key (e.g. "base"). If the server's
 *   accepts list contains that chain, it's used. Otherwise the first matching
 *   accepts entry that's in the local registry is used.
 */
export function createPayingFetch(mnemonic, options = {}) {
  const preferredKey =
    options.preferredChainKey || process.env.OWS_CHAIN || null;
  const preferred = preferredKey ? getChain(preferredKey) : null;

  // Build a wallet client per accepted chain, lazily. We need the signer at
  // payment time, and the chain isn't known until the server's accepts are
  // returned. Cache by chainId.
  const account = mnemonicToAccount(mnemonic);
  const signerCache = new Map();

  function signerFor(chainId) {
    if (signerCache.has(chainId)) return signerCache.get(chainId);
    const chain = getChain(chainId);
    if (!chain) {
      throw new Error(`Server offered chainId ${chainId}, but it's not in the local chain registry. Add it to scripts/chains.mjs.`);
    }
    const viemChain = toViemChain(chain);
    const walletClient = createWalletClient({
      account,
      chain: viemChain,
      transport: http(chain.rpc),
    });
    walletClient.address = walletClient.account.address;
    const publicClient = createPublicClient({
      chain: viemChain,
      transport: http(chain.rpc),
    });
    const signer = toClientEvmSigner(walletClient, publicClient);
    const scheme = new GatewayEvmScheme(signer);
    const entry = { scheme, chain };
    signerCache.set(chainId, entry);
    return entry;
  }

  // Wrap the scheme registration with a lazy resolver: when x402Client picks an
  // accepts entry, it calls scheme.createPaymentPayload — we route to the right
  // per-chain signer at that moment.
  const dispatcherScheme = {
    scheme: "exact",
    createPaymentPayload: async (x402Version, paymentRequirements) => {
      const m = paymentRequirements.network.match(/eip155:(\d+)/);
      const chainId = m ? parseInt(m[1]) : null;
      const { scheme } = signerFor(chainId);
      return scheme.createPaymentPayload(x402Version, paymentRequirements);
    },
  };

  const client = new x402Client((_, accepts) => {
    // Filter to networks we know about locally.
    const known = accepts.filter((a) => getChain(a.network));
    if (known.length === 0) {
      throw new Error(`Server offered no networks in our registry. accepts=${accepts.map((a) => a.network).join(",")}`);
    }
    if (preferred) {
      const match = known.find((a) => a.network === preferred.network);
      if (match) return match;
    }
    return known[0];
  });

  SUPPORTED_NETWORKS.forEach((n) => client.register(n, dispatcherScheme));

  return {
    fetch: wrapFetchWithPayment(fetch, client),
    address: account.address,
    preferredChain: preferred,
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2 || args.includes("--help") || args.includes("-h")) {
    console.log(`Usage: node x402_client.mjs <METHOD> <URL> [--body <json>] [--mnemonic <phrase>] [--mnemonic-env <ENV_NAME>] [--chain <key>]

Examples:
  node x402_client.mjs POST "https://api.aisa.one/apis/v2/scholar/search/scholar?query=AI" --body '{}'
  node x402_client.mjs GET  "https://api.aisa.one/apis/v2/polymarket/markets?search=election"
  node x402_client.mjs GET  "https://api.aisa.one/apis/v2/twitter/user/info?userName=jack" --chain base

Options:
  --body <json>        Request body (default: '{}' for POST, none for GET)
  --mnemonic <phrase>  Wallet mnemonic
  --mnemonic-env <V>   Read mnemonic from arbitrary env var name
  --chain <key>        Preferred chain key from registry (e.g. "base", "ethereum")

Environment:
  OWS_MNEMONIC   BIP-39 mnemonic for the paying wallet
  X402_MNEMONIC  Alternate mnemonic env name
  OWS_CHAIN      Default preferred chain key
  OWS_RPC_<KEY>  Per-chain RPC override (e.g. OWS_RPC_BASE)`);
    process.exit(0);
  }

  const method = args[0].toUpperCase();
  const url = args[1];

  let body = undefined;
  let mnemonic = process.env.OWS_MNEMONIC || process.env.X402_MNEMONIC;
  let mnemonicEnvName = undefined;
  let preferredChainKey = undefined;

  for (let i = 2; i < args.length; i++) {
    if (args[i] === "--body" && args[i + 1]) body = args[++i];
    else if (args[i] === "--mnemonic" && args[i + 1]) mnemonic = args[++i];
    else if (args[i] === "--mnemonic-env" && args[i + 1]) mnemonicEnvName = args[++i];
    else if (args[i] === "--chain" && args[i + 1]) preferredChainKey = args[++i];
  }

  if (!mnemonic && mnemonicEnvName) mnemonic = process.env[mnemonicEnvName];

  if (!mnemonic) {
    console.error("Error: mnemonic not found. Set OWS_MNEMONIC or X402_MNEMONIC, use a local .env, or pass --mnemonic-env / --mnemonic.");
    process.exit(1);
  }

  const { fetch: payingFetch, address, preferredChain } = createPayingFetch(mnemonic, {
    preferredChainKey,
  });
  console.error(`Wallet: ${address}`);
  if (preferredChain) console.error(`Preferred chain: ${preferredChain.name} (${preferredChain.id})`);
  console.error(`Request: ${method} ${url}`);

  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = body;
  if (method === "POST" && !body) opts.body = "{}";

  const res = await payingFetch(url, opts);
  console.error(`Status: ${res.status}`);

  const text = await res.text();

  if (res.status === 403 && text.includes("Pre-deduction failed")) {
    console.error("\n⚠ Insufficient AIsa Gateway balance.");
    console.error("Steps to resolve:");
    console.error("  1. Check balances across all chains:");
    console.error("     node scripts/setup.mjs balance --all");
    console.error("  2. Pick a chain to deposit on (e.g. base) and approve + deposit USDC:");
    console.error("     node scripts/setup.mjs all --chain base --amount 5");
    console.error("  3. Retry the request.\n");
    console.error("AIsa-accepted chains: ethereum, base, avalanche, arbitrum, optimism,");
    console.error("polygon, unichain, sonic, worldchain, sei, hyperevm.\n");
  }

  process.stdout.write(text + "\n");
  process.exit(res.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
