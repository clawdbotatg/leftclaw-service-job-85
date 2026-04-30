# Clawd & Effect

A Hex Address Based Tipping Machine.

Pick a cause — a fun reason based on hex address patterns. Tip some CLAWD. See who gets it.

## What it is

Clawd & Effect is a static dApp on Base that lets anyone tip CLAWD tokens to a holder picked deterministically by a "criteria" function over a baked-in CLAWD-holder snapshot. The user picks one of 47 criteria, enters a CLAWD amount, approves the contract, and tips. The winning address is hidden until the transaction confirms.

## Stack

- Smart contract: `ClawdAndEffect.sol` — a thin pass-through that calls `safeTransferFrom` on the CLAWD token to the chosen winner. Deployed on Base mainnet.
- Frontend: Scaffold-ETH 2 (Next.js, RainbowKit, wagmi, viem) — built as a static export and served from IPFS.
- Holder snapshot: baked into `packages/nextjs/public/holders.json` at build time. Generated once via `packages/nextjs/scripts/generate-holders.ts` (Alchemy + viem) and committed to the repo for reproducibility.

## Deployed contracts (Base, chain 8453)

- ClawdAndEffect: `0x24d4e699d5a7758ba6a943243ab9bed9e8911cff`
- CLAWD token (ERC-20): `0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07`

## Local development

```bash
yarn install

# Frontend (against the live Base contract)
cd packages/nextjs
echo "NEXT_PUBLIC_BASE_RPC=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY" > .env.local
yarn start

# Regenerate the holder snapshot
ALCHEMY_API_KEY=YOUR_KEY npx tsx scripts/generate-holders.ts
```

## IPFS-ready static build

```bash
cd packages/nextjs
rm -rf .next out
NEXT_PUBLIC_PRODUCTION_URL="https://leftclaw-service-job-85.placeholder/" \
  NODE_OPTIONS="--require ./polyfill-localstorage.cjs" \
  NEXT_PUBLIC_IPFS_BUILD=true \
  NEXT_PUBLIC_IGNORE_BUILD_ERROR=true \
  yarn build
```

Output ships to `packages/nextjs/out/`.

## Disclaimers

- Holder snapshot is a one-time bake. Holders that arrive after the snapshot block are not eligible to win.
- Ties are broken randomly with `Math.random()`.
- The 47 criteria are deterministic given the snapshot but several rely on a uniform random tie-break.

Made by one community member with the help of LeftClaw Services beta. Use at your own risk.
