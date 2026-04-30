/**
 * generate-holders.ts
 *
 * Builds packages/nextjs/public/holders.json — a baked-in snapshot of CLAWD
 * token holders on Base, used by the Clawd & Effect frontend at runtime to
 * pick a deterministic winner per criteria.
 *
 * Run once:
 *   ALCHEMY_API_KEY=... npx tsx packages/nextjs/scripts/generate-holders.ts
 *
 * Strategy:
 *   1) Use alchemy_getAssetTransfers (paginated, no block-range size cap) to
 *      collect every unique address that ever appeared as `from` or `to` on
 *      a CLAWD ERC-20 transfer. Faster than chunked eth_getLogs.
 *   2) Drop address(0) and the token itself.
 *   3) Multicall balanceOf(address) at the snapshot block for every
 *      candidate.
 *   4) Filter zero balances. Sort by balance desc. Write to public/holders.json.
 */
import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { createPublicClient, getAddress, http, parseAbi } from "viem";
import { base } from "viem/chains";

const CLAWD_TOKEN = "0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07" as const;
// First Transfer event: alchemy_getAssetTransfers reported block 0x276c232
const CLAWD_DEPLOY_BLOCK = 41476658n;
// Final snapshot block (chosen finalized at script-build time).
const SNAPSHOT_BLOCK = 45359403n;
const SNAPSHOT_DATE = "2026-04-30T00:15:53Z";

// Multicall batching for balanceOf
const MULTICALL_CHUNK = 500;

const ERC20_ABI = parseAbi(["function balanceOf(address) view returns (uint256)"]);

type AlchemyTransfersResponse = {
  result: {
    transfers: { from: string | null; to: string | null }[];
    pageKey?: string;
  };
};

async function fetchAllAddresses(rpcUrl: string): Promise<Set<string>> {
  const seen = new Set<string>();
  let pageKey: string | undefined;
  let page = 0;
  // toBlock hex of SNAPSHOT_BLOCK
  const toBlockHex = "0x" + SNAPSHOT_BLOCK.toString(16);
  const fromBlockHex = "0x" + CLAWD_DEPLOY_BLOCK.toString(16);
  while (true) {
    page++;
    const params: Record<string, unknown> = {
      fromBlock: fromBlockHex,
      toBlock: toBlockHex,
      contractAddresses: [CLAWD_TOKEN],
      category: ["erc20"],
      order: "asc",
      maxCount: "0x3e8", // 1000 per page
      withMetadata: false,
    };
    if (pageKey) params.pageKey = pageKey;
    const body = JSON.stringify({
      jsonrpc: "2.0",
      id: page,
      method: "alchemy_getAssetTransfers",
      params: [params],
    });
    let resp: AlchemyTransfersResponse | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const r = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = (await r.json()) as AlchemyTransfersResponse & { error?: { message: string } };
        if ((j as any).error) throw new Error((j as any).error.message);
        resp = j;
        break;
      } catch (e) {
        console.warn(`[holders] page ${page} attempt ${attempt + 1}: ${(e as Error).message}`);
        await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
    if (!resp) throw new Error(`page ${page} failed after retries`);
    for (const t of resp.result.transfers) {
      if (t.from) seen.add(t.from.toLowerCase());
      if (t.to) seen.add(t.to.toLowerCase());
    }
    process.stdout.write(`\r[holders] page=${page} transfers=${resp.result.transfers.length} unique=${seen.size}     `);
    if (!resp.result.pageKey) break;
    pageKey = resp.result.pageKey;
  }
  process.stdout.write("\n");
  return seen;
}

async function main() {
  const apiKey = process.env.ALCHEMY_API_KEY;
  if (!apiKey) throw new Error("ALCHEMY_API_KEY missing in env");

  const rpcUrl = `https://base-mainnet.g.alchemy.com/v2/${apiKey}`;
  const client = createPublicClient({
    chain: base,
    transport: http(rpcUrl, { batch: true }),
  });

  console.log(`[holders] CLAWD ${CLAWD_TOKEN}`);
  console.log(`[holders] deploy block ${CLAWD_DEPLOY_BLOCK} → snapshot block ${SNAPSHOT_BLOCK}`);

  const seen = await fetchAllAddresses(rpcUrl);
  // Drop the zero address and the token itself
  seen.delete("0x0000000000000000000000000000000000000000");
  seen.delete(CLAWD_TOKEN.toLowerCase());

  const candidates = [...seen];
  console.log(`[holders] ${candidates.length} unique addresses ever touched CLAWD`);

  // Multicall balanceOf at snapshot block
  const balances = new Map<string, bigint>();
  for (let i = 0; i < candidates.length; i += MULTICALL_CHUNK) {
    const chunk = candidates.slice(i, i + MULTICALL_CHUNK);
    const calls = chunk.map(addr => ({
      address: CLAWD_TOKEN,
      abi: ERC20_ABI,
      functionName: "balanceOf" as const,
      args: [getAddress(addr)] as const,
    }));
    let results: any[] = [];
    let attempt = 0;
    while (true) {
      try {
        results = await client.multicall({
          contracts: calls,
          blockNumber: SNAPSHOT_BLOCK,
          allowFailure: true,
        });
        break;
      } catch (e) {
        attempt++;
        if (attempt > 5) throw e;
        console.warn(`[holders] multicall ${i} retry ${attempt}: ${(e as Error).message}`);
        await new Promise(r => setTimeout(r, 1500 * attempt));
      }
    }
    chunk.forEach((addr, j) => {
      const r = results[j];
      if (r.status === "success" && typeof r.result === "bigint" && r.result > 0n) {
        balances.set(addr, r.result);
      }
    });
    process.stdout.write(`\r[holders] balances ${i + chunk.length}/${candidates.length} held=${balances.size}     `);
  }
  process.stdout.write("\n");

  // Sort by balance desc for deterministic output
  const holders = [...balances.entries()].sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0));

  const out = {
    snapshotDate: SNAPSHOT_DATE,
    snapshotBlock: Number(SNAPSHOT_BLOCK),
    tokenAddress: CLAWD_TOKEN.toLowerCase(),
    holderCount: holders.length,
    holders: holders.map(([addr]) => addr),
  };

  const outPath = path.resolve(__dirname, "../public/holders.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  const sizeKb = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log(`[holders] wrote ${outPath} — ${holders.length} holders, ${sizeKb}KB`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
