#!/usr/bin/env node
/**
 * x402 Wallet Setup — approve and deposit USDC into Circle Gateway.
 *
 * Supports 11 EVM mainnets + Arc Testnet (legacy). See scripts/chains.mjs
 * for the full registry.
 *
 * Usage:
 *   node setup.mjs address                                            Print wallet address
 *   node setup.mjs balance       [--chain <key|id>] [--all]           Check balances (--all = every chain)
 *   node setup.mjs approve        --chain <key|id>  [--cap <usdc>]    Approve Gateway to spend USDC
 *   node setup.mjs deposit        --chain <key|id>  [--amount <usdc>] Deposit USDC into Gateway
 *   node setup.mjs all            --chain <key|id>  [--amount] [--cap] Approve + deposit + balance
 *   node setup.mjs deposit-all    --amount <usdc>  [--cap N] [--execute]
 *                                                                     Deposit N USDC from EVERY AIsa-accepted
 *                                                                     mainnet that has the funds. Dry-run by
 *                                                                     default; pass --execute to send txns.
 *   node setup.mjs chains                                             List supported chains
 *
 * Chain selection precedence: --chain flag > OWS_CHAIN env > error.
 * Mainnet is real money — there is no default chain.
 *
 * Environment:
 *   OWS_MNEMONIC          BIP-39 mnemonic for the wallet
 *   OWS_CHAIN             Default chain key (e.g. "base", "ethereum")
 *   OWS_RPC_<KEY>         Per-chain RPC override (e.g. OWS_RPC_BASE)
 *   OWS_RPC_URL           Legacy global RPC override (applied to selected chain)
 */

import fs from "fs";
import path from "path";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseAbi,
  maxUint256,
  formatUnits,
  parseUnits,
} from "viem";
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

// ---------------------------------------------------------------------------
// ABIs
// ---------------------------------------------------------------------------

const ERC20_ABI = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

const GATEWAY_ABI = parseAbi([
  "function deposit(address token, uint256 amount)",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createClients(mnemonic, chain) {
  const account = mnemonicToAccount(mnemonic);
  const viemChain = toViemChain(chain);
  const walletClient = createWalletClient({
    account,
    chain: viemChain,
    transport: http(chain.rpc),
  });
  const publicClient = createPublicClient({
    chain: viemChain,
    transport: http(chain.rpc),
  });
  return { account, walletClient, publicClient };
}

function warnMainnet(chain) {
  if (chain.testnet) return;
  console.warn(`⚠  MAINNET: ${chain.name} (chainId ${chain.id}). Real funds at stake.`);
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function checkBalanceForChain(chain, address) {
  const publicClient = createPublicClient({
    chain: toViemChain(chain),
    transport: http(chain.rpc),
  });

  const [nativeBal, tokenBal, allowance] = await Promise.all([
    publicClient.getBalance({ address }),
    publicClient.readContract({
      address: chain.usdc,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [address],
    }),
    publicClient.readContract({
      address: chain.usdc,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [address, chain.gatewayWallet],
    }),
  ]);

  const native = `${formatUnits(nativeBal, chain.native.decimals)} ${chain.native.symbol}`;
  const usdc = `${formatUnits(tokenBal, 6)} USDC`;
  const allow =
    allowance === maxUint256 ? "unlimited" : `${formatUnits(allowance, 6)} USDC`;

  return { native, usdc, allow, nativeBal, tokenBal, allowance };
}

async function showBalanceOne(chain, address) {
  console.log(`\nWallet: ${address}`);
  console.log(`Chain:  ${chain.name} (${chain.id})${chain.testnet ? " [testnet]" : ""}${chain.aisaAccepted ? "" : " [AIsa: not accepted]"}`);
  console.log(`RPC:    ${chain.rpc}\n`);
  const { native, usdc, allow, allowance } = await checkBalanceForChain(chain, address);
  console.log(`Native (gas):      ${native}`);
  console.log(`ERC-20 USDC:       ${usdc}`);
  console.log(`Gateway allowance: ${allow}`);
  return { allowance };
}

async function showBalanceAll(address) {
  console.log(`\nWallet: ${address}\n`);
  const rows = [];
  for (const entry of listChains()) {
    const chain = getChain(entry.key);
    try {
      const { native, usdc, allow } = await checkBalanceForChain(chain, address);
      rows.push({ chain: chain.name, id: chain.id, usdc, native, allow });
    } catch (err) {
      rows.push({ chain: chain.name, id: chain.id, usdc: `error: ${err.shortMessage || err.message}`, native: "—", allow: "—" });
    }
  }
  console.table(rows);
}

async function approveGateway(walletClient, publicClient, chain, capUsdc) {
  const amount = capUsdc == null ? maxUint256 : parseUnits(capUsdc.toString(), 6);
  const label = capUsdc == null ? "unlimited" : `${capUsdc} USDC`;
  console.log(`Approving Gateway (${chain.gatewayWallet}) to spend USDC on ${chain.name} (cap: ${label})...`);
  const hash = await walletClient.writeContract({
    address: chain.usdc,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [chain.gatewayWallet, amount],
  });
  console.log(`  Tx: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  Status: ${receipt.status}`);
  console.log(`  Block: ${receipt.blockNumber}`);
  return receipt;
}

/**
 * After an `approve` tx is mined, public RPC providers can take a few seconds
 * to propagate the new state across all their backend nodes. viem's pre-flight
 * simulation for the next write may hit a stale node and revert with
 * "exceeds allowance" even though the approve succeeded. Poll `allowance` here
 * until it reflects the expected value before proceeding.
 */
async function waitForAllowance(publicClient, chain, owner, spender, minAmount, { maxAttempts = 20, intervalMs = 500 } = {}) {
  for (let i = 0; i < maxAttempts; i++) {
    const current = await publicClient.readContract({
      address: chain.usdc,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [owner, spender],
    });
    if (current >= minAmount) return current;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`allowance for ${spender} did not reach ${minAmount} within ${maxAttempts * intervalMs}ms — RPC propagation may be slow, retry shortly.`);
}

async function depositToGateway(walletClient, publicClient, chain, amountUsdc) {
  const amount = BigInt(Math.round(amountUsdc * 1e6));
  console.log(`Depositing ${amountUsdc} USDC into Gateway on ${chain.name}...`);
  const hash = await walletClient.writeContract({
    address: chain.gatewayWallet,
    abi: GATEWAY_ABI,
    functionName: "deposit",
    args: [chain.usdc, amount],
  });
  console.log(`  Tx: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  Status: ${receipt.status}`);
  console.log(`  Block: ${receipt.blockNumber}`);
  return receipt;
}

/**
 * deposit-all: across every AIsa-accepted EVM mainnet, plan and (optionally)
 * execute a deposit of `amountUsdc` USDC into Circle Gateway. Always plans
 * first; only sends transactions when `execute` is true.
 */
async function depositAll(mnemonic, account, { amountUsdc, capUsdc, execute }) {
  const targets = listChains({ includeTestnet: false }).filter((c) => c.aisaAccepted);
  const amount = BigInt(Math.round(amountUsdc * 1e6));

  console.log(`Wallet: ${account.address}`);
  console.log(`Plan:   deposit ${amountUsdc} USDC on each of ${targets.length} chains where balance + gas allow.\n`);

  const plan = [];
  for (const entry of targets) {
    const chain = getChain(entry.key);
    try {
      const publicClient = createPublicClient({
        chain: toViemChain(chain),
        transport: http(chain.rpc),
      });
      const [nativeBal, tokenBal, allowance] = await Promise.all([
        publicClient.getBalance({ address: account.address }),
        publicClient.readContract({
          address: chain.usdc,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [account.address],
        }),
        publicClient.readContract({
          address: chain.usdc,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [account.address, chain.gatewayWallet],
        }),
      ]);

      const usdcOk = tokenBal >= amount;
      const gasOk = nativeBal > 0n;
      const needsApprove = allowance < amount;
      const action = !usdcOk
        ? "skip (insufficient USDC)"
        : !gasOk
        ? "skip (no native gas)"
        : needsApprove
        ? "approve + deposit"
        : "deposit";

      plan.push({
        chain: chain.name,
        id: chain.id,
        usdc: `${formatUnits(tokenBal, 6)}`,
        gas: `${formatUnits(nativeBal, chain.native.decimals)} ${chain.native.symbol}`,
        action,
        _key: entry.key,
        _willAct: usdcOk && gasOk,
        _needsApprove: needsApprove,
      });
    } catch (err) {
      plan.push({
        chain: chain.name,
        id: chain.id,
        usdc: "—",
        gas: "—",
        action: `error: ${err.shortMessage || err.message}`,
        _key: entry.key,
        _willAct: false,
        _needsApprove: false,
      });
    }
  }

  console.table(plan.map(({ _key, _willAct, _needsApprove, ...row }) => row));

  const willAct = plan.filter((p) => p._willAct);
  console.log(`\nWill act on ${willAct.length} of ${targets.length} chains.`);

  if (!execute) {
    console.log("\nDry run. Pass --execute to send transactions.");
    return;
  }

  if (willAct.length === 0) {
    console.log("Nothing to execute.");
    return;
  }

  console.log(`\n⚠  MAINNET EXECUTION: about to send up to ${willAct.length * 2} transactions across ${willAct.length} chains.`);
  console.log("Proceeding in 5 seconds. Ctrl-C to abort.\n");
  await new Promise((r) => setTimeout(r, 5000));

  const results = [];
  for (const row of willAct) {
    const chain = getChain(row._key);
    const { walletClient, publicClient } = createClients(mnemonic, chain);
    console.log(`\n--- ${chain.name} (${chain.id}) ---`);
    try {
      if (row._needsApprove) {
        await approveGateway(walletClient, publicClient, chain, capUsdc);
        process.stdout.write("  Waiting for allowance to propagate...");
        await waitForAllowance(publicClient, chain, account.address, chain.gatewayWallet, amount);
        console.log(" ok.");
      }
      const receipt = await depositToGateway(walletClient, publicClient, chain, amountUsdc);
      results.push({ chain: chain.name, status: "ok", tx: receipt.transactionHash });
    } catch (err) {
      results.push({ chain: chain.name, status: "error", tx: err.shortMessage || err.message });
    }
  }

  console.log("\n--- Summary ---");
  console.table(results);
}

function listSupportedChains() {
  const rows = listChains().map((c) => ({
    key: c.key,
    id: c.id,
    name: c.name,
    network: c.network,
    aisa: c.aisaAccepted ? "✓" : "—",
    type: c.testnet ? "testnet" : "mainnet",
  }));
  console.table(rows);
}

function resolveChain(flagValue) {
  const sel = flagValue || process.env.OWS_CHAIN;
  if (!sel) return null;
  const chain = getChain(sel);
  if (!chain) {
    console.error(`Error: unknown chain "${sel}". Run \`node setup.mjs chains\` to list options.`);
    process.exit(1);
  }
  return chain;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    console.log(`Usage: node setup.mjs <command> [options]

Commands:
  chains                                                List supported chains
  address                                               Print wallet address
  balance [--chain <key|id>] [--all]                    Show balances (--all = every chain)
  approve     --chain <key|id> [--cap <usdc>]           Approve Gateway USDC spend (default: unlimited)
  deposit     --chain <key|id> [--amount <usdc>]        Deposit N USDC into Gateway (default: 10)
  all         --chain <key|id> [--amount N] [--cap N]   Approve + deposit + balance check
  deposit-all  --amount <usdc> [--cap N] [--execute]    Deposit N USDC on every AIsa-accepted chain
                                                        with sufficient balance + gas. DRY-RUN by
                                                        default; --execute sends real transactions.

Options:
  --chain <key|id>     Chain selector — registry key (e.g. "base") or chainId (e.g. 8453)
  --mnemonic <phrase>  Wallet mnemonic (or set OWS_MNEMONIC / X402_MNEMONIC / .env)
  --amount <usdc>      Deposit amount (default: 10 USDC; required for deposit-all)
  --cap <usdc>         Cap ERC-20 approval at this amount (default: unlimited).
                       Lower caps reduce exposure if Gateway is ever compromised.
  --execute            For \`deposit-all\`: actually send transactions (default: dry-run)
  --all                For \`balance\`: query every registered chain

Environment:
  OWS_MNEMONIC         Primary BIP-39 mnemonic
  X402_MNEMONIC        Alternate mnemonic env name
  OWS_CHAIN            Default chain key
  OWS_RPC_<KEY>        Per-chain RPC override (e.g. OWS_RPC_BASE)
  OWS_RPC_URL          Legacy global RPC override (applied to selected chain only)

Notes:
  - 11 EVM mainnets accepted by AIsa: ethereum, base, avalanche, arbitrum, optimism,
    polygon, unichain, sonic, worldchain, sei, hyperevm.
  - Arc Testnet (arcTestnet) is in the registry for legacy wallets but is no longer
    accepted by AIsa for paid endpoints (since 2026-04-26).
  - Mainnet has no default chain — pick explicitly.`);
    process.exit(0);
  }

  if (command === "chains") {
    listSupportedChains();
    process.exit(0);
  }

  // Parse flags
  let mnemonic = process.env.OWS_MNEMONIC || process.env.X402_MNEMONIC;
  let amount = 10;
  let amountExplicit = false;
  let cap = null;
  let chainFlag = null;
  let allChains = false;
  let execute = false;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--mnemonic" && args[i + 1]) mnemonic = args[++i];
    else if (args[i] === "--amount" && args[i + 1]) {
      amount = parseFloat(args[++i]);
      amountExplicit = true;
    } else if (args[i] === "--cap" && args[i + 1]) cap = parseFloat(args[++i]);
    else if (args[i] === "--chain" && args[i + 1]) chainFlag = args[++i];
    else if (args[i] === "--all") allChains = true;
    else if (args[i] === "--execute") execute = true;
  }

  if (!mnemonic) {
    console.error("Error: mnemonic not found. Set OWS_MNEMONIC or X402_MNEMONIC, use a local .env, or pass --mnemonic.");
    process.exit(1);
  }

  const account = mnemonicToAccount(mnemonic);

  // address: no chain needed
  if (command === "address") {
    console.log(account.address);
    return;
  }

  // balance --all: iterate every chain
  if (command === "balance" && allChains) {
    await showBalanceAll(account.address);
    return;
  }

  // deposit-all: orchestrate deposits across every AIsa-accepted mainnet
  if (command === "deposit-all") {
    if (!amountExplicit) {
      console.error("Error: --amount <usdc> is required for deposit-all (no implicit default).");
      process.exit(1);
    }
    await depositAll(mnemonic, account, { amountUsdc: amount, capUsdc: cap, execute });
    return;
  }

  // Everything else needs a chain
  const chain = resolveChain(chainFlag);
  if (!chain) {
    console.error("Error: --chain is required (or set OWS_CHAIN). Run `node setup.mjs chains` to list options.");
    process.exit(1);
  }

  if (command !== "balance") warnMainnet(chain);
  if (!chain.aisaAccepted && command !== "balance") {
    console.warn(`⚠  ${chain.name} is NOT accepted by AIsa for paid endpoints. Deposits here cannot pay for API calls.`);
  }

  const { walletClient, publicClient } = createClients(mnemonic, chain);

  switch (command) {
    case "balance":
      await showBalanceOne(chain, account.address);
      break;

    case "approve":
      await approveGateway(walletClient, publicClient, chain, cap);
      console.log("Done.");
      break;

    case "deposit":
      await depositToGateway(walletClient, publicClient, chain, amount);
      console.log("Done.");
      break;

    case "all": {
      console.log("--- Step 1: Check initial balance ---");
      const { allowance } = await showBalanceOne(chain, account.address);
      const requiredAmount = BigInt(Math.round(amount * 1e6));
      let justApproved = false;

      if (allowance < requiredAmount) {
        console.log("\n--- Step 2: Approve Gateway ---");
        await approveGateway(walletClient, publicClient, chain, cap);
        justApproved = true;
      } else {
        console.log("\n--- Step 2: Approve Gateway (sufficient allowance already) ---");
      }

      if (justApproved) {
        process.stdout.write("  Waiting for allowance to propagate across RPC nodes...");
        await waitForAllowance(publicClient, chain, account.address, chain.gatewayWallet, requiredAmount);
        console.log(" ok.");
      }

      console.log(`\n--- Step 3: Deposit ${amount} USDC ---`);
      await depositToGateway(walletClient, publicClient, chain, amount);

      console.log("\n--- Step 4: Final balance ---");
      await showBalanceOne(chain, account.address);
      console.log("\nSetup complete. You can now make x402 payments on this chain.");
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
