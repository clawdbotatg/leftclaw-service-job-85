import * as chains from "viem/chains";

export type BaseConfig = {
  targetNetworks: readonly chains.Chain[];
  pollingInterval: number;
  alchemyApiKey: string;
  rpcOverrides?: Record<number, string>;
  walletConnectProjectId: string;
  burnerWalletMode: "localNetworksOnly" | "allNetworks" | "disabled";
};

export type ScaffoldConfig = BaseConfig;

// SE2 ships with a shared default Alchemy key checked into the scaffold —
// removed for production. If `NEXT_PUBLIC_ALCHEMY_API_KEY` is unset, fall
// through to an empty string and let `rpcOverrides[base.id]` be the source
// of truth (set NEXT_PUBLIC_BASE_RPC). The empty value here means we never
// silently leak a shared SE2 key to public traffic.
export const DEFAULT_ALCHEMY_API_KEY = "";

// Build the Base RPC override URL from environment. Prefer a dedicated RPC
// (NEXT_PUBLIC_BASE_RPC), then fall back to a project-owned Alchemy URL.
// If neither is set we omit the override entirely so wagmi falls back to
// the chain's default public RPC — this is loud but safe (no leaked key).
const baseRpcOverride =
  process.env.NEXT_PUBLIC_BASE_RPC ||
  (process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
    ? `https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
    : undefined);

const scaffoldConfig = {
  // Live on Base mainnet only.
  targetNetworks: [chains.base],
  // L2 — poll fast.
  pollingInterval: 3000,
  // NEXT_PUBLIC_ALCHEMY_API_KEY is read at build time. Empty string if unset.
  alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || DEFAULT_ALCHEMY_API_KEY,
  rpcOverrides: baseRpcOverride ? { [chains.base.id]: baseRpcOverride } : {},
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "3a8170812b534d0ff9d794f19a901d64",
  // Disable burner wallet completely on production builds. We're on Base mainnet only.
  burnerWalletMode: "disabled",
} as const satisfies ScaffoldConfig;

export default scaffoldConfig;
