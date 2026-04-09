# Troubleshooting

## Missing mnemonic

Cause:
- `OWS_MNEMONIC` or `X402_MNEMONIC` is not visible to the running process

Fix:
- run `bash scripts/check-env.sh`
- inject the env into the OpenClaw runtime or pass `--mnemonic-env` / `--mnemonic`

## invalid_signature

Fix:
- use `paymentRequirements.extra.verifyingContract`, not the token address, for the EIP-712 domain

## insufficient_balance

Fix:
- approve ERC-20 USDC and call `deposit()` on the Gateway contract

## Empty or misleading HTTP 200 responses

Fix:
- inspect the response body, not only the status code
- use curl with `--http1.1` if debugging transport behavior
