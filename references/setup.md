# Setup

## Runtime guidance

OpenClaw may not see environment variables exported in an unrelated interactive shell. If a mnemonic is missing during agent execution, set it where the OpenClaw process actually runs or pass it explicitly with a CLI flag.

Mnemonic resolution order in this package:
1. `OWS_MNEMONIC`
2. `X402_MNEMONIC`
3. `--mnemonic-env VAR_NAME`
4. `--mnemonic "..."`

## Chain details

- Arc testnet chain ID: `5042002`
- RPC: `https://rpc.testnet.arc.network`
- Explorer: `https://testnet.arcscan.app/`
- Faucet: `https://faucet.circle.com/`
- ERC-20 USDC token: `0x3600000000000000000000000000000000000000`
- GatewayWalletBatched: `0x0077777d7eba4688bdef3e311b846f25870a19b9`
- API base: `https://api.aisa.one`

## Notes

- `/apis/v2/...` uses x402 payment negotiation.
- The JS client is preferred over fragile CLI payment flows.
- Some POST endpoints may still expect query parameters plus `{}` as the body.
