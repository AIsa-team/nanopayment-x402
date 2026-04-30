#!/usr/bin/env bash
set -euo pipefail
BASE_URL="${AISA_X402_BASE_URL:-https://api.aisa.one}"

echo "== cwd =="
pwd

echo
echo "== binaries =="
for bin in node npm curl; do
  if command -v "$bin" >/dev/null 2>&1; then
    echo "ok: found $bin"
  else
    echo "missing: $bin"
  fi
done

echo
echo "== env =="
if [ -n "${OWS_MNEMONIC:-}" ]; then
  echo "ok: OWS_MNEMONIC is set"
elif [ -n "${X402_MNEMONIC:-}" ]; then
  echo "ok: X402_MNEMONIC is set"
else
  echo "missing: OWS_MNEMONIC or X402_MNEMONIC"
fi

if [ -n "${OWS_CHAIN:-}" ]; then
  echo "ok: OWS_CHAIN=$OWS_CHAIN"
else
  echo "info: OWS_CHAIN not set — pass --chain to setup.mjs commands"
fi

echo
echo "== network =="
echo "API base: $BASE_URL"
API_PROBE=$(mktemp)
API_CODE=$(curl --http1.1 -sS -o "$API_PROBE" -w "%{http_code}" "$BASE_URL/apis/v2/healthz" || true)
echo "api healthz status: ${API_CODE:-unreachable}"
rm -f "$API_PROBE"

echo "Per-chain RPCs are checked lazily by setup.mjs. Run 'node scripts/setup.mjs balance --all' to probe all 11 chains + Arc Testnet."

echo
echo "== deps =="
for pkg in @x402/fetch @x402/evm viem; do
  if [ -d "node_modules/${pkg}" ] || npm ls "$pkg" >/dev/null 2>&1; then
    echo "ok: $pkg installed"
  else
    echo "missing: $pkg"
  fi
done
