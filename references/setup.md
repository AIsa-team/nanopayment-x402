# Setup

## Persisting a mnemonic for OpenClaw workspace use

Interactive shell exports often do not propagate into the running OpenClaw agent process. To make the mnemonic reusable across commands in this workspace, use:

```bash
node scripts/save-mnemonic.mjs --mnemonic "..."
```

or:

```bash
node scripts/save-mnemonic.mjs --wallet my-wallet-name
```

This writes or updates a local `.env` file in the skill directory with:

- `OWS_MNEMONIC=...`

After saving, commands launched from the skill directory can load `.env` automatically when supported by the script.

## Notes

- Treat `.env` as sensitive.
- Do not commit `.env` to git.
- A mnemonic shown in terminal output should be treated as exposed.
