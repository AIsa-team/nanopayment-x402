#!/usr/bin/env node
/**
 * Gasless Gateway deposit via Eco's programmable-address service.
 *
 * Overview:
 *   The user has USDC on Base / OP / Arbitrum but no native gas on that chain.
 *   Eco generates a deterministic deposit address (CREATE2 contract) that can
 *   only publish a Routes intent. The user signs a USDC ERC-3009
 *   `transferWithAuthorization` to that address; Eco's deposit-address service
 *   broadcasts (eats source-chain gas), then routes via CCTP into the user's
 *   Circle Gateway balance on Polygon. Eco's solver pays Polygon gas.
 *
 * Eco docs: https://eco.com/docs/getting-started/programmable-addresses/gateway-deposits
 *
 * Usage:
 *   node scripts/deposit-via-eco.mjs --amount <usdc>            \
 *                                    [--source <base|optimism|arbitrum|baseSepolia|opSepolia|arbSepolia>] \
 *                                    [--env mainnet|preproduction] \
 *                                    [--execute]                \
 *                                    [--poll-timeout-secs N]
 *
 * Dry-run by default — generates (or fetches) the deposit address and prints
 * the plan. Pass --execute to sign + submit. --poll-timeout-secs defaults to
 * 120 (typical fulfillment is 20-40s per Eco's docs).
 *
 * Constraints:
 *   - Source chains (mainnet): base, optimism, arbitrum only.
 *   - Destination: Circle Gateway balance on Polygon (preproduction: Polygon Amoy).
 *   - For other source chains (Ethereum, Avalanche, Sei, etc.), use
 *     `setup.mjs deposit --chain <key>` (direct, requires native gas).
 */

import fs from "fs";
import path from "path";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  parseUnits,
  getAddress,
} from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { CHAINS, getChain, toViemChain } from "./chains.mjs";

// ---------------------------------------------------------------------------
// .env loader (cwd-relative)
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

// ---------------------------------------------------------------------------
// Eco environments + testnet source chains (kept inline; not in chains.mjs
// because chains.mjs is the AIsa-accepted-mainnet registry)
// ---------------------------------------------------------------------------

const ECO_ENVS = {
  mainnet: {
    apiBase: "https://deposit-addresses.eco.com",
    destinationLabel: "Circle Gateway on Polygon",
    sources: ["base", "optimism", "arbitrum"],
  },
  preproduction: {
    apiBase: "https://deposit-addresses-preproduction.eco.com",
    destinationLabel: "Circle Gateway on Polygon Amoy",
    sources: ["baseSepolia", "opSepolia", "arbSepolia"],
  },
};

const ECO_TESTNET_CHAINS = {
  baseSepolia: {
    key: "baseSepolia",
    id: 84532,
    name: "Base Sepolia",
    network: "eip155:84532",
    defaultRpc: "https://sepolia.base.org",
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    native: { name: "Ether", symbol: "ETH", decimals: 18 },
  },
  opSepolia: {
    key: "opSepolia",
    id: 11155420,
    name: "OP Sepolia",
    network: "eip155:11155420",
    defaultRpc: "https://sepolia.optimism.io",
    usdc: "0x5fD84259d66Cd46123540766Be93DFE6D43130D7",
    native: { name: "Ether", symbol: "ETH", decimals: 18 },
  },
  arbSepolia: {
    key: "arbSepolia",
    id: 421614,
    name: "Arb Sepolia",
    network: "eip155:421614",
    defaultRpc: "https://sepolia-rollup.arbitrum.io/rpc",
    usdc: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
    native: { name: "Ether", symbol: "ETH", decimals: 18 },
  },
};

function resolveSourceChain(key) {
  const mainnet = getChain(key);
  if (mainnet && !mainnet.testnet) return mainnet;
  const testnet = ECO_TESTNET_CHAINS[key];
  if (!testnet) return null;
  const envKey = `OWS_RPC_${testnet.key.toUpperCase()}`;
  const rpc = process.env[envKey] || process.env.OWS_RPC_URL || testnet.defaultRpc;
  return { ...testnet, rpc, gatewayWallet: null };
}

// ---------------------------------------------------------------------------
// USDC ERC-3009
// ---------------------------------------------------------------------------

const USDC_ABI = parseAbi([
  "function name() view returns (string)",
  "function version() view returns (string)",
  "function balanceOf(address owner) view returns (uint256)",
]);

async function getUsdcDomain(publicClient, chain) {
  const [name, version] = await Promise.all([
    publicClient.readContract({ address: chain.usdc, abi: USDC_ABI, functionName: "name" }),
    publicClient.readContract({ address: chain.usdc, abi: USDC_ABI, functionName: "version" }),
  ]);
  return {
    name,
    version,
    chainId: chain.id,
    verifyingContract: getAddress(chain.usdc),
  };
}

async function getUsdcBalance(publicClient, chain, address) {
  return publicClient.readContract({
    address: chain.usdc,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: [address],
  });
}

// ---------------------------------------------------------------------------
// Eco API
// ---------------------------------------------------------------------------

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const msg = typeof body === "object" ? JSON.stringify(body) : String(body || "(empty)");
    throw new Error(`HTTP ${res.status} from ${url}: ${msg}`);
  }
  return body;
}

async function generateDepositAddress(env, sourceChain, depositor) {
  const url = `${env.apiBase}/api/v1/depositAddresses/gateway/polygon`;
  const body = await fetchJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chainId: sourceChain.id,
      depositor,
      evmDestinationAddress: depositor,
    }),
  });
  return body.data;
}

async function submitGaslessTransfer(env, payload) {
  const url = `${env.apiBase}/api/v1/gasless/transferWithAuthorization`;
  const body = await fetchJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return body.data;
}

async function getJob(env, jobId) {
  const url = `${env.apiBase}/api/v1/gasless/jobs/${jobId}`;
  const body = await fetchJson(url, { method: "GET" });
  return body.data;
}

async function pollJob(env, jobId, timeoutSecs) {
  const start = Date.now();
  let last = null;
  while ((Date.now() - start) / 1000 < timeoutSecs) {
    const job = await getJob(env, jobId);
    if (job.status !== last) {
      console.log(`  [${Math.round((Date.now() - start) / 1000)}s] status=${job.status}${job.transferTxHash ? ` transfer=${job.transferTxHash}` : ""}${job.intentHash ? ` intent=${job.intentHash}` : ""}`);
      last = job.status;
    }
    if (job.status === "COMPLETED" || job.status === "FAILED") return job;
    await new Promise((r) => setTimeout(r, 3000));
  }
  return { status: "TIMEOUT" };
}

// ---------------------------------------------------------------------------
// Main flow
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = {
    amount: null,
    sourceKey: "base",
    envKey: "mainnet",
    execute: false,
    pollTimeoutSecs: 120,
    mnemonic: process.env.OWS_MNEMONIC || process.env.X402_MNEMONIC,
  };
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "--help" || args[i] === "-h")) return null;
    else if (args[i] === "--amount" && args[i + 1]) out.amount = parseFloat(args[++i]);
    else if (args[i] === "--source" && args[i + 1]) out.sourceKey = args[++i];
    else if (args[i] === "--env" && args[i + 1]) out.envKey = args[++i];
    else if (args[i] === "--execute") out.execute = true;
    else if (args[i] === "--poll-timeout-secs" && args[i + 1]) out.pollTimeoutSecs = parseInt(args[++i]);
    else if (args[i] === "--mnemonic" && args[i + 1]) out.mnemonic = args[++i];
  }
  return out;
}

function printHelp() {
  console.log(`Usage: node scripts/deposit-via-eco.mjs --amount <usdc> [options]

Gasless Gateway deposit via Eco's programmable-address service. Useful when
the wallet has USDC on Base/OP/Arbitrum but no native gas there.

Required:
  --amount <usdc>          Amount of USDC to deposit

Options:
  --source <key>           Source chain (default: base)
                           mainnet:        base, optimism, arbitrum
                           preproduction:  baseSepolia, opSepolia, arbSepolia
  --env <env>              mainnet (default) or preproduction
  --execute                Sign + submit + poll (default: dry-run only)
  --poll-timeout-secs N    Max seconds to poll job status (default: 120)
  --mnemonic <phrase>      Override OWS_MNEMONIC / X402_MNEMONIC / .env

Destination:
  Circle Gateway balance on Polygon (mainnet) or Polygon Amoy (preproduction).
  Once credited, AIsa endpoints (eip155:137 in their accepts list) can be paid
  from this balance via x402_client.mjs.`);
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts === null) { printHelp(); process.exit(0); }

  if (opts.amount == null || !(opts.amount > 0)) {
    console.error("Error: --amount <usdc> is required and must be > 0.");
    process.exit(1);
  }
  if (!opts.mnemonic) {
    console.error("Error: mnemonic not found. Set OWS_MNEMONIC or pass --mnemonic.");
    process.exit(1);
  }
  const env = ECO_ENVS[opts.envKey];
  if (!env) {
    console.error(`Error: unknown --env "${opts.envKey}". Use mainnet or preproduction.`);
    process.exit(1);
  }
  if (!env.sources.includes(opts.sourceKey)) {
    console.error(`Error: --source "${opts.sourceKey}" not supported in env "${opts.envKey}". Allowed: ${env.sources.join(", ")}`);
    process.exit(1);
  }

  const sourceChain = resolveSourceChain(opts.sourceKey);
  if (!sourceChain) {
    console.error(`Error: chain "${opts.sourceKey}" not in registry.`);
    process.exit(1);
  }

  const account = mnemonicToAccount(opts.mnemonic);
  const publicClient = createPublicClient({
    chain: toViemChain(sourceChain),
    transport: http(sourceChain.rpc),
  });

  console.log(`Wallet:       ${account.address}`);
  console.log(`Env:          ${opts.envKey} (${env.apiBase})`);
  console.log(`Source:       ${sourceChain.name} (${sourceChain.id}) — USDC at ${sourceChain.usdc}`);
  console.log(`Destination:  ${env.destinationLabel}`);
  console.log(`Amount:       ${opts.amount} USDC`);

  // 1. Generate deposit address (deterministic + idempotent — safe in dry-run)
  console.log("\nGenerating Eco deposit address...");
  const addr = await generateDepositAddress(env, sourceChain, account.address);
  console.log(`  Deposit address: ${addr.evmDepositAddress}`);
  console.log(`  Deployed:        ${addr.isDeployed}`);
  if (addr.createdAt) console.log(`  Created:         ${addr.createdAt}`);

  // 2. USDC balance — informational in dry-run, gating in --execute
  const balance = await getUsdcBalance(publicClient, sourceChain, account.address);
  const amountWei = parseUnits(opts.amount.toString(), 6);
  console.log(`\nUSDC balance: ${Number(balance) / 1e6} USDC (need ${opts.amount})`);

  if (!opts.execute) {
    if (balance < amountWei) {
      console.log(`\n⚠  Insufficient USDC for the requested amount.`);
      console.log(`Fund ${account.address} with ${opts.amount} USDC on ${sourceChain.name} before running with --execute.`);
    }
    console.log("\nDry run. Pass --execute to sign and submit.");
    return;
  }

  if (balance < amountWei) {
    console.error(`Error: USDC balance (${Number(balance) / 1e6}) is below requested amount (${opts.amount}).`);
    process.exit(1);
  }

  // 3. Build + sign ERC-3009 TransferWithAuthorization
  console.log("\nReading USDC EIP-712 domain from contract...");
  const domain = await getUsdcDomain(publicClient, sourceChain);
  console.log(`  name=${JSON.stringify(domain.name)} version=${JSON.stringify(domain.version)} verifyingContract=${domain.verifyingContract}`);

  const nonce = "0x" + [...crypto.getRandomValues(new Uint8Array(32))]
    .map((b) => b.toString(16).padStart(2, "0")).join("");
  const validAfter = 0n;
  const validBefore = BigInt(Math.floor(Date.now() / 1000) + 60 * 60); // 1 hour

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
    from: account.address,
    to: getAddress(addr.evmDepositAddress),
    value: amountWei,
    validAfter,
    validBefore,
    nonce,
  };

  const walletClient = createWalletClient({
    account,
    chain: toViemChain(sourceChain),
    transport: http(sourceChain.rpc),
  });
  const signature = await walletClient.signTypedData({
    account,
    domain,
    types,
    primaryType: "TransferWithAuthorization",
    message,
  });
  console.log(`  signature: ${signature.slice(0, 12)}…${signature.slice(-8)}`);

  // 4. Submit to Eco
  console.log("\nSubmitting gasless transfer to Eco...");
  const job = await submitGaslessTransfer(env, {
    chainId: sourceChain.id,
    from: account.address,
    to: addr.evmDepositAddress,
    value: amountWei.toString(),
    validAfter: validAfter.toString(),
    validBefore: validBefore.toString(),
    nonce,
    signature,
  });
  console.log(`  job id: ${job.id}`);
  console.log(`  initial status: ${job.status}`);

  // 5. Poll
  console.log(`\nPolling job (timeout ${opts.pollTimeoutSecs}s)...`);
  const final = await pollJob(env, job.id, opts.pollTimeoutSecs);

  console.log("\n--- Result ---");
  console.log(JSON.stringify(final, null, 2));

  if (final.status !== "COMPLETED") {
    console.log(`\n⚠  Status: ${final.status}.`);
    console.log("Per Eco's docs, intents have a ~4-hour deadline. If unfulfilled,");
    console.log("an independent permissionless refund service returns the USDC to");
    console.log(`${account.address}. Check the deposit address (${addr.evmDepositAddress})`);
    console.log("on the source-chain explorer for refund tx.");
    process.exit(1);
  }
  console.log(`\n✓ Deposit credited to Gateway. Check Polygon (or Polygon Amoy) Gateway balance to confirm.`);
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
