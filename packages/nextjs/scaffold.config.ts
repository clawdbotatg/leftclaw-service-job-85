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

export const DEFAULT_ALCHEMY_API_KEY = "cR4WnXePioePZ5fFrnSiR";

const scaffoldConfig = {
  // Live on Base mainnet only.
  targetNetworks: [chains.base],
  // L2 — poll fast.
  pollingInterval: 3000,
  // NEXT_PUBLIC_ALCHEMY_API_KEY is read at build time. Falls back to SE2 default.
  alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || DEFAULT_ALCHEMY_API_KEY,
  // Use a dedicated Base RPC if provided (set NEXT_PUBLIC_BASE_RPC in
  // packages/nextjs/.env.local). Otherwise fall back to the public Alchemy
  // template URL composed from NEXT_PUBLIC_ALCHEMY_API_KEY at runtime.
  rpcOverrides: {
    [chains.base.id]:
      process.env.NEXT_PUBLIC_BASE_RPC ||
      `https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || DEFAULT_ALCHEMY_API_KEY}`,
  },
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "3a8170812b534d0ff9d794f19a901d64",
  // Disable burner wallet completely on production builds. We're on Base mainnet only.
  burnerWalletMode: "disabled",
} as const satisfies ScaffoldConfig;

export default scaffoldConfig;
