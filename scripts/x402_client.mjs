#!/usr/bin/env node
/**
 * x402 Payment Client — pay-per-call API requests via Circle Gateway.
 *
 * Usage:
 *   node x402_client.mjs <method> <url> [--body <json>] [--mnemonic <phrase>]
 *
 * Examples:
 *   node x402_client.mjs POST "https://api.aisa.one/apis/v2/scholar/search/scholar?query=AI" --body '{}'
 *   node x402_client.mjs GET  "https://api.aisa.one/apis/v2/polymarket/markets?search=election"
 *
 * Environment:
 *   OWS_MNEMONIC  — BIP-39 mnemonic for the paying wallet (or use --mnemonic)
 *   OWS_RPC_URL   — Arc testnet RPC (default: https://rpc.testnet.arc.network)
 *   OWS_CHAIN_ID  — Preferred chain ID (default: 5042002)
 */

import fs from "fs";
import path from "path";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { toClientEvmSigner } from "@x402/evm";
import { createWalletClient, createPublicClient, http, getAddress } from "viem";
import { mnemonicToAccount } from "viem/accounts";

// ---------------------------------------------------------------------------
// Config
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

const RPC_URL = process.env.OWS_RPC_URL || "https://rpc.testnet.arc.network";
const PREFERRED_CHAIN = `eip155:${process.env.OWS_CHAIN_ID || "5042002"}`;

const SUPPORTED_NETWORKS = [
  "eip155:5042002", "eip155:11155111", "eip155:84532", "eip155:43113",
  "eip155:421614", "eip155:14601", "eip155:4801", "eip155:1328",
  "eip155:998", "eip155:11155420", "eip155:80002", "eip155:1301",
];

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
    const chainId = chainIdMatch ? parseInt(chainIdMatch[1]) : 5042002;

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

export function createPayingFetch(mnemonic, options = {}) {
  const rpcUrl = options.rpcUrl || RPC_URL;
  const preferredChain = options.preferredChain || PREFERRED_CHAIN;

  const arcTestnet = {
    id: parseInt(preferredChain.split(":")[1]),
    name: "Arc Testnet",
    nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  };

  const account = mnemonicToAccount(mnemonic);
  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(rpcUrl),
  });
  walletClient.address = walletClient.account.address;

  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(rpcUrl),
  });

  const evmSigner = toClientEvmSigner(walletClient, publicClient);
  const scheme = new GatewayEvmScheme(evmSigner);

  const client = new x402Client((_, accepts) => {
    return accepts.find((a) => a.network === preferredChain) || accepts[0];
  });

  SUPPORTED_NETWORKS.forEach((n) => client.register(n, scheme));

  return {
    fetch: wrapFetchWithPayment(fetch, client),
    address: account.address,
    walletClient,
    publicClient,
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2 || args.includes("--help") || args.includes("-h")) {
    console.log(`Usage: node x402_client.mjs <METHOD> <URL> [--body <json>] [--mnemonic <phrase>] [--mnemonic-env <ENV_NAME>]

Examples:
  node x402_client.mjs POST "https://api.aisa.one/apis/v2/scholar/search/scholar?query=AI" --body '{}'
  node x402_client.mjs GET  "https://api.aisa.one/apis/v2/polymarket/markets?search=election"
  node x402_client.mjs POST "https://api.aisa.one/apis/v2/scholar/search/scholar?query=bitcoin" --body '{}' --mnemonic-env OWS_MNEMONIC

Environment:
  OWS_MNEMONIC  BIP-39 mnemonic for the paying wallet
  X402_MNEMONIC Alternate mnemonic env name
  OWS_RPC_URL   Arc testnet RPC (default: https://rpc.testnet.arc.network)
  OWS_CHAIN_ID  Preferred chain ID (default: 5042002)`);
    process.exit(0);
  }

  const method = args[0].toUpperCase();
  const url = args[1];

  let body = undefined;
  let mnemonic = process.env.OWS_MNEMONIC || process.env.X402_MNEMONIC;
  let mnemonicEnvName = undefined;

  for (let i = 2; i < args.length; i++) {
    if (args[i] === "--body" && args[i + 1]) {
      body = args[++i];
    } else if (args[i] === "--mnemonic" && args[i + 1]) {
      mnemonic = args[++i];
    } else if (args[i] === "--mnemonic-env" && args[i + 1]) {
      mnemonicEnvName = args[++i];
    }
  }

  if (!mnemonic && mnemonicEnvName) {
    mnemonic = process.env[mnemonicEnvName];
  }

  if (!mnemonic) {
    console.error("Error: mnemonic not found. Set OWS_MNEMONIC or X402_MNEMONIC in the agent environment, or pass --mnemonic-env / --mnemonic.");
    process.exit(1);
  }

  const { fetch: payingFetch, address } = createPayingFetch(mnemonic);
  console.error(`Wallet: ${address}`);
  console.error(`Request: ${method} ${url}`);

  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = body;
  // POST endpoints with no body still need '{}'
  if (method === "POST" && !body) opts.body = "{}";

  const res = await payingFetch(url, opts);
  console.error(`Status: ${res.status}`);

  const text = await res.text();

  // Detect 403 pre-deduction failures and provide actionable instructions
  if (res.status === 403 && text.includes("Pre-deduction failed")) {
    console.error("\n⚠ Insufficient AIsa API quota.");
    console.error("Steps to resolve:");
    console.error("  1. Check current balance:");
    console.error("     node scripts/setup.mjs balance");
    console.error("  2. If wallet USDC balance on Arc testnet is below 5 USDC, claim more from the faucet:");
    console.error("     https://faucet.circle.com/");
    console.error("  3. Deposit USDC into the Gateway contract:");
    console.error("     node scripts/setup.mjs deposit --amount 5");
    console.error("  4. Retry the failed request.\n");
  }

  // Output JSON to stdout for piping
  process.stdout.write(text + "\n");

  process.exit(res.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
