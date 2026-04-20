#!/usr/bin/env node
/**
 * x402 Wallet Setup — approve and deposit USDC into Circle Gateway on Arc testnet.
 *
 * Usage:
 *   node setup.mjs approve  [--mnemonic <phrase>] [--cap <usdc>]     Approve Gateway to spend USDC (default: unlimited)
 *   node setup.mjs deposit  [--mnemonic <phrase>] [--amount <usdc>]  Deposit USDC into Gateway
 *   node setup.mjs balance  [--mnemonic <phrase>]                    Check all balances
 *   node setup.mjs all      [--mnemonic <phrase>] [--amount <usdc>] [--cap <usdc>]  Approve + deposit + check
 *
 * Environment:
 *   OWS_MNEMONIC  — BIP-39 mnemonic for the wallet
 *   OWS_RPC_URL   — Arc testnet RPC (default: https://rpc.testnet.arc.network)
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

// ---------------------------------------------------------------------------
// Constants
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

const ARC_TESTNET = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
};

const USDC = "0x3600000000000000000000000000000000000000";
const GATEWAY = "0x0077777d7eba4688bdef3e311b846f25870a19b9";

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

function createClients(mnemonic) {
  const account = mnemonicToAccount(mnemonic);
  const walletClient = createWalletClient({
    account,
    chain: ARC_TESTNET,
    transport: http(RPC_URL),
  });
  const publicClient = createPublicClient({
    chain: ARC_TESTNET,
    transport: http(RPC_URL),
  });
  return { account, walletClient, publicClient };
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function checkBalance(publicClient, address) {
  console.log(`\nWallet: ${address}`);
  console.log(`Chain:  Arc Testnet (5042002)`);
  console.log(`RPC:    ${RPC_URL}\n`);

  // Native balance (18 decimals)
  const nativeBal = await publicClient.getBalance({ address });
  console.log(`Native USDC (gas): ${formatUnits(nativeBal, 18)} USDC`);

  // ERC-20 token balance (6 decimals)
  const tokenBal = await publicClient.readContract({
    address: USDC,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [address],
  });
  console.log(`ERC-20 USDC:       ${formatUnits(tokenBal, 6)} USDC`);

  // Allowance to Gateway
  const allowance = await publicClient.readContract({
    address: USDC,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [address, GATEWAY],
  });
  const allowanceStr =
    allowance === maxUint256 ? "unlimited" : `${formatUnits(allowance, 6)} USDC`;
  console.log(`Gateway allowance: ${allowanceStr}`);

  return { nativeBal, tokenBal, allowance };
}

async function approveGateway(walletClient, publicClient, capUsdc) {
  const amount = capUsdc == null ? maxUint256 : parseUnits(capUsdc.toString(), 6);
  const label = capUsdc == null ? "unlimited" : `${capUsdc} USDC`;
  console.log(`Approving Gateway to spend USDC (cap: ${label})...`);
  const hash = await walletClient.writeContract({
    address: USDC,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [GATEWAY, amount],
  });
  console.log(`  Tx: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  Status: ${receipt.status}`);
  console.log(`  Block: ${receipt.blockNumber}`);
  return receipt;
}

async function depositToGateway(walletClient, publicClient, amountUsdc) {
  const amount = BigInt(Math.round(amountUsdc * 1e6));
  console.log(`Depositing ${amountUsdc} USDC into Gateway...`);
  const hash = await walletClient.writeContract({
    address: GATEWAY,
    abi: GATEWAY_ABI,
    functionName: "deposit",
    args: [USDC, amount],
  });
  console.log(`  Tx: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  Status: ${receipt.status}`);
  console.log(`  Block: ${receipt.blockNumber}`);
  return receipt;
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
  address                          Print the wallet address derived from the mnemonic
  balance                          Check native, token, and Gateway allowance balances
  approve [--cap N]                Approve Gateway to spend USDC (default: unlimited; cap in USDC)
  deposit [--amount N]             Deposit N USDC into Gateway (default: 10)
  all     [--amount N] [--cap N]   Approve + deposit + balance check

Options:
  --mnemonic <phrase>     Wallet mnemonic (or set OWS_MNEMONIC / X402_MNEMONIC / local .env)
  --amount <usdc>         Amount of USDC to deposit (default: 10)
  --cap <usdc>            Cap the ERC-20 approval at this amount in USDC (default: unlimited).
                          Lower caps reduce exposure if the Gateway contract is ever compromised.

Environment:
  OWS_MNEMONIC            Primary BIP-39 mnemonic
  X402_MNEMONIC           Alternate mnemonic env name
  OWS_RPC_URL             RPC endpoint (default: https://rpc.testnet.arc.network)

Notes:
  setup.mjs auto-loads a local .env file from the current working directory when present.`);
    process.exit(0);
  }

  let mnemonic = process.env.OWS_MNEMONIC || process.env.X402_MNEMONIC;
  let amount = 10;
  let cap = null;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--mnemonic" && args[i + 1]) mnemonic = args[++i];
    if (args[i] === "--amount" && args[i + 1]) amount = parseFloat(args[++i]);
    if (args[i] === "--cap" && args[i + 1]) cap = parseFloat(args[++i]);
  }

  if (!mnemonic) {
    console.error("Error: mnemonic not found. Set OWS_MNEMONIC or X402_MNEMONIC, use a local .env, or pass --mnemonic.");
    process.exit(1);
  }

  const { account, walletClient, publicClient } = createClients(mnemonic);

  switch (command) {
    case "address":
      console.log(account.address);
      break;

    case "balance":
      await checkBalance(publicClient, account.address);
      break;

    case "approve":
      await approveGateway(walletClient, publicClient, cap);
      console.log("Done.");
      break;

    case "deposit":
      await depositToGateway(walletClient, publicClient, amount);
      console.log("Done.");
      break;

    case "all":
      console.log("--- Step 1: Check initial balance ---");
      const { allowance } = await checkBalance(publicClient, account.address);

      if (allowance === 0n) {
        console.log("\n--- Step 2: Approve Gateway ---");
        await approveGateway(walletClient, publicClient, cap);
      } else {
        console.log("\n--- Step 2: Approve Gateway (already approved) ---");
      }

      console.log(`\n--- Step 3: Deposit ${amount} USDC ---`);
      await depositToGateway(walletClient, publicClient, amount);

      console.log("\n--- Step 4: Final balance ---");
      await checkBalance(publicClient, account.address);
      console.log("\nSetup complete. You can now make x402 payments.");
      break;

    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
