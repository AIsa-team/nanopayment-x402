#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const args = process.argv.slice(2);
let mnemonic = null;
let wallet = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--mnemonic' && args[i + 1]) mnemonic = args[++i];
  else if (args[i] === '--wallet' && args[i + 1]) wallet = args[++i];
}

if (!mnemonic && wallet) {
  mnemonic = execFileSync('npx', ['--yes', '@open-wallet-standard/core', 'wallet', 'export', '--wallet', wallet], {
    encoding: 'utf8'
  }).trim();
}

if (!mnemonic) {
  console.error('Usage: node scripts/save-mnemonic.mjs --mnemonic "..." | --wallet <name>');
  process.exit(1);
}

const envPath = path.resolve(process.cwd(), '.env');
let lines = [];
if (fs.existsSync(envPath)) lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
const filtered = lines.filter(line => !line.startsWith('OWS_MNEMONIC='));
filtered.push(`OWS_MNEMONIC=${mnemonic}`);
fs.writeFileSync(envPath, filtered.filter(Boolean).join('\n') + '\n');
console.log(`Saved OWS_MNEMONIC to ${envPath}`);
