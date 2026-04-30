#!/usr/bin/env node
/**
 * x402 Payment Inspector — captures every signed EIP-712 payload the wallet
 * produces against an x402-paid endpoint. Useful for debugging signature
 * verification issues (wrong domain, wrong types, stale validity windows).
 *
 * Usage:
 *   node scripts/inspect_x402.mjs <METHOD> <URL> [<METHOD2> <URL2> ...] [--chain <key>]
 *
 * Examples:
 *   node scripts/inspect_x402.mjs GET "https://api.aisa.one/apis/v2/twitter/user/info?userName=jack"
 *   node scripts/inspect_x402.mjs GET "https://api.aisa.one/apis/v2/coingecko/simple/price?ids=bitcoin&vs_currencies=usd" --chain base
 *
 * Reads the same env as the rest of the repo: OWS_MNEMONIC + OWS_CHAIN +
 * OWS_RPC_<KEY>. Auto-loads .env from cwd.
 */

import fs from "fs";
import path from "path";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { toClientEvmSigner } from "@x402/evm";
import { createWalletClient, createPublicClient, http, getAddress } from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { getChain, listChains, toViemChain } from "./chains.mjs";

// ---------------------------------------------------------------------------
// .env loader (cwd-relative, same pattern as setup.mjs)
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

const SUPPORTED_NETWORKS = listChains().map((c) => c.network);

// ---------------------------------------------------------------------------
// Logging signer — same EIP-712 flow as x402_client.mjs, but captures every
// signed payload for inspection.
// ---------------------------------------------------------------------------

const captured = [];

class LoggingGatewayEvmScheme {
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

    const m = paymentRequirements.network.match(/eip155:(\d+)/);
    const chainId = m ? parseInt(m[1]) : null;
    if (chainId == null) {
      throw new Error(`Cannot parse chainId from network: ${paymentRequirements.network}`);
    }

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

    captured.push({
      requirements: {
        network: paymentRequirements.network,
        payTo: paymentRequirements.payTo,
        amount: paymentRequirements.amount,
        asset: paymentRequirements.asset,
        extra: paymentRequirements.extra,
        maxTimeoutSeconds: paymentRequirements.maxTimeoutSeconds,
        scheme: paymentRequirements.scheme,
        resource: paymentRequirements.resource,
        description: paymentRequirements.description,
      },
      domain,
      primaryType: "TransferWithAuthorization",
      types,
      message: { ...authorization },
      signature,
    });

    return { x402Version, payload: { authorization, signature } };
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printHelp() {
  console.log(`Usage: node scripts/inspect_x402.mjs <METHOD> <URL> [<METHOD> <URL> ...] [--chain <key>]

Examples:
  node scripts/inspect_x402.mjs GET "https://api.aisa.one/apis/v2/twitter/user/info?userName=jack"
  node scripts/inspect_x402.mjs GET "https://api.aisa.one/apis/v2/twitter/user/info?userName=jack" \\
                                GET "https://api.aisa.one/apis/v2/coingecko/simple/price?ids=bitcoin&vs_currencies=usd" \\
                                --chain base

Captures the full signed EIP-712 payload for each request and prints it to stdout.

Environment:
  OWS_MNEMONIC   BIP-39 mnemonic for the paying wallet
  OWS_CHAIN      Preferred chain key (used if the server offers it)
  OWS_RPC_<KEY>  Per-chain RPC override (e.g. OWS_RPC_BASE)`);
}

const args = process.argv.slice(2);
if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  printHelp();
  process.exit(args.length === 0 ? 1 : 0);
}

let preferredChainKey = null;
const targets = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--chain" && args[i + 1]) {
    preferredChainKey = args[++i];
    continue;
  }
  const method = args[i].toUpperCase();
  const url = args[i + 1];
  if (!/^(GET|POST|PUT|DELETE|PATCH)$/.test(method) || !url) {
    console.error(`Error: expected METHOD URL pairs, got ${method} ${url}`);
    printHelp();
    process.exit(1);
  }
  targets.push({ method, url });
  i++;
}

const mnemonic = process.env.OWS_MNEMONIC || process.env.X402_MNEMONIC;
if (!mnemonic) {
  console.error("Error: OWS_MNEMONIC not set (also tried X402_MNEMONIC). Add it to .env or export it.");
  process.exit(1);
}

const account = mnemonicToAccount(mnemonic);
const preferred = preferredChainKey
  ? getChain(preferredChainKey) || (() => { throw new Error(`Unknown chain key: ${preferredChainKey}`); })()
  : (process.env.OWS_CHAIN ? getChain(process.env.OWS_CHAIN) : null);

const signerCache = new Map();
function signerFor(chainId) {
  if (signerCache.has(chainId)) return signerCache.get(chainId);
  const chain = getChain(chainId);
  if (!chain) throw new Error(`chainId ${chainId} not in scripts/chains.mjs registry`);
  const viemChain = toViemChain(chain);
  const walletClient = createWalletClient({ account, chain: viemChain, transport: http(chain.rpc) });
  walletClient.address = walletClient.account.address;
  const publicClient = createPublicClient({ chain: viemChain, transport: http(chain.rpc) });
  const signer = toClientEvmSigner(walletClient, publicClient);
  const scheme = new LoggingGatewayEvmScheme(signer);
  signerCache.set(chainId, scheme);
  return scheme;
}

const dispatcherScheme = {
  scheme: "exact",
  createPaymentPayload: async (v, req) => {
    const m = req.network.match(/eip155:(\d+)/);
    const chainId = m ? parseInt(m[1]) : null;
    return signerFor(chainId).createPaymentPayload(v, req);
  },
};

const client = new x402Client((_, accepts) => {
  const known = accepts.filter((a) => getChain(a.network));
  if (known.length === 0) {
    throw new Error(`Server offered no chains in registry. accepts=${accepts.map((a) => a.network).join(",")}`);
  }
  if (preferred) {
    const match = known.find((a) => a.network === preferred.network);
    if (match) return match;
  }
  return known[0];
});
SUPPORTED_NETWORKS.forEach((n) => client.register(n, dispatcherScheme));

const payingFetch = wrapFetchWithPayment(fetch, client);

console.log(`Wallet: ${account.address}`);
if (preferred) console.log(`Preferred chain: ${preferred.name} (${preferred.id})`);
console.log("");

for (const t of targets) {
  console.log(`▶ ${t.method} ${t.url}`);
  try {
    const res = await payingFetch(t.url, {
      method: t.method,
      headers: { "Content-Type": "application/json" },
      body: t.method === "POST" ? "{}" : undefined,
    });
    console.log(`  status: ${res.status}\n`);
  } catch (err) {
    console.log(`  error: ${err.message}\n`);
  }
}

console.log("═".repeat(80));
console.log(`CAPTURED OFF-CHAIN SIGNED PAYMENTS (${captured.length})`);
console.log("═".repeat(80));
captured.forEach((c, i) => {
  console.log(`\n— Payment ${i + 1}: ${targets[i]?.method} ${targets[i]?.url} —`);
  console.log(JSON.stringify(c, (k, v) => (typeof v === "bigint" ? v.toString() : v), 2));
});
