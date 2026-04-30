"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Address as AddressView } from "@scaffold-ui/components";
import { formatUnits, isAddress, parseUnits } from "viem";
import { base } from "viem/chains";
import { useAccount, useChainId, useSwitchChain, useWaitForTransactionReceipt } from "wagmi";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import deployedContracts from "~~/contracts/deployedContracts";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { criteria as ALL_CRITERIA, type Criterion } from "~~/lib/criteria";
import { getParsedError, notification } from "~~/utils/scaffold-eth";

/**
 * Mobile deep-link helper. After a write call has been fired (the wallet
 * received the request), nudge the user back to their wallet app on mobile
 * so they don't have to manually switch — fixes a common UX foot-gun where
 * users tap "Send" in dApp browsers and never see the wallet prompt.
 *
 * Only triggers on touch devices; desktop wallets handle their own focus.
 */
const isMobileUA = () => typeof navigator !== "undefined" && /android|iphone|ipad|mobile/i.test(navigator.userAgent);

const writeAndOpen = async <T,>(write: () => Promise<T>): Promise<T> => {
  const promise = write();
  if (isMobileUA()) {
    setTimeout(() => {
      if (typeof window !== "undefined") {
        // walletconnect:// is the most broadly-supported deep link; on iOS it
        // hands off to the wallet picker, on Android most wallets register it.
        window.location.href = "walletconnect://";
      }
    }, 2000);
  }
  return promise;
};

// CLAWD has 18 decimals (verified from rawContract.decimal=0x12 returned by
// alchemy_getAssetTransfers). Hardcoding so we don't need an extra read.
const CLAWD_DECIMALS = 18;

type Snapshot = {
  snapshotDate: string;
  snapshotBlock: number;
  tokenAddress: string;
  holderCount: number;
  holders: string[];
};

type RevealState = {
  txHash: `0x${string}`;
  winner: `0x${string}`;
  criterionId: number;
  criterionName: string;
  amount: bigint;
};

const SUPPORTED_CHAIN_ID = base.id;
const TIP_CONTRACT_ADDRESS = (deployedContracts as unknown as Record<number, Record<string, { address: string }>>)[
  SUPPORTED_CHAIN_ID
].ClawdAndEffect.address as `0x${string}`;

/**
 * The single interactive surface of the dApp.
 *
 * State machine for the action button (only ONE button shown at a time):
 *
 *   not connected            → "Connect Wallet" (RainbowKit)
 *   wrong chain              → "Switch to Base"
 *   connected + correct chain
 *      ├─ no criterion picked        → criterion list (no button)
 *      ├─ amount empty / 0           → disabled "Enter an amount"
 *      ├─ allowance < amount         → "Approve CLAWD" (exact-amount approve)
 *      ├─ approve pending / mining   → disabled "Approving..."
 *      ├─ approved + tip pending     → disabled "Tipping..."
 *      ├─ tx mined, no reveal yet    → mystery loading
 *      └─ post-reveal                → "Tip again"
 */
export const TipFlow = ({ snapshot }: { snapshot: Snapshot }) => {
  const { address: connectedAddress, isConnected } = useAccount();
  const chainId = useChainId();
  const onCorrectChain = chainId === SUPPORTED_CHAIN_ID;
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  // ---------- selected criterion + amount input ----------
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selectedCriterion: Criterion | undefined = useMemo(
    () => (selectedId == null ? undefined : ALL_CRITERIA.find(c => c.id === selectedId)),
    [selectedId],
  );
  const [amountStr, setAmountStr] = useState("");
  const parsedAmount: bigint | null = useMemo(() => {
    if (!amountStr) return null;
    if (!/^\d*\.?\d*$/.test(amountStr)) return null;
    try {
      const v = parseUnits(amountStr as `${number}`, CLAWD_DECIMALS);
      return v > 0n ? v : null;
    } catch {
      return null;
    }
  }, [amountStr]);

  // ---------- on-chain reads ----------
  // Allowance: spender is the ClawdAndEffect contract (it calls
  // SafeERC20.safeTransferFrom on the CLAWD token using msg.sender, so the
  // user must approve the ClawdAndEffect contract address).
  const { data: rawAllowance, refetch: refetchAllowance } = useScaffoldReadContract({
    contractName: "CLAWD",
    functionName: "allowance",
    args: [connectedAddress, TIP_CONTRACT_ADDRESS] as const,
  });
  const allowance: bigint = (rawAllowance as bigint | undefined) ?? 0n;

  const { data: rawBalance } = useScaffoldReadContract({
    contractName: "CLAWD",
    functionName: "balanceOf",
    args: [connectedAddress] as const,
  });
  const balance: bigint = (rawBalance as bigint | undefined) ?? 0n;

  const { data: tokenSymbol } = useScaffoldReadContract({
    contractName: "CLAWD",
    functionName: "symbol",
  });

  // ---------- write hooks ----------
  // approve(spender=ClawdAndEffect, value=exact amount)
  const { writeContractAsync: approveAsync, isMining: isApproveMining } = useScaffoldWriteContract({
    contractName: "CLAWD",
  });
  // tip(winner, criteriaId, amount)
  const { writeContractAsync: tipAsync, isMining: isTipMining } = useScaffoldWriteContract({
    contractName: "ClawdAndEffect",
  });

  // ---------- mining + reveal state machine ----------
  const [pendingTxHash, setPendingTxHash] = useState<`0x${string}` | undefined>();
  const [pendingReveal, setPendingReveal] = useState<RevealState | null>(null);
  const [reveal, setReveal] = useState<RevealState | null>(null);
  const [cooldown, setCooldown] = useState(false);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Persistent inline error surfaced under the action button. SE2's
  // useTransactor already toasts errors, but a toast disappears in seconds —
  // an inline message is the lasting feedback the user can refer back to.
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: txReceipt } = useWaitForTransactionReceipt({
    hash: pendingTxHash,
    chainId: SUPPORTED_CHAIN_ID,
  });

  // When a tip tx confirms, flip pendingReveal → reveal.
  useEffect(() => {
    if (txReceipt && pendingReveal && pendingReveal.txHash === txReceipt.transactionHash) {
      setReveal(pendingReveal);
      setPendingReveal(null);
      setPendingTxHash(undefined);
      // Refetch allowance now that it has been spent.
      void refetchAllowance();
    }
  }, [txReceipt, pendingReveal, refetchAllowance]);

  // Approve cooldown: stale-allowance protection. After approve mines we
  // briefly keep the tip button disabled and refetch allowance.
  const startCooldown = (ms = 4000) => {
    setCooldown(true);
    if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
    cooldownTimer.current = setTimeout(() => setCooldown(false), ms);
  };
  useEffect(
    () => () => {
      if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
    },
    [],
  );

  // ---------- handlers ----------
  const handleApprove = async () => {
    if (!parsedAmount) return;
    setErrorMessage(null);
    try {
      const hash = await writeAndOpen(() =>
        approveAsync({
          functionName: "approve",
          args: [TIP_CONTRACT_ADDRESS, parsedAmount],
        }),
      );
      // approveAsync resolves once the transaction is confirmed by SE2's
      // useTransactor (it calls waitForTransactionReceipt under the hood).
      // Order matters: start the cooldown FIRST so there is no microtask gap
      // where both `isApproveMining` and `cooldown` are false (which would
      // briefly re-render the Approve button as enabled). THEN refetch the
      // allowance so the next paint sees the new value.
      if (hash) {
        startCooldown();
        await refetchAllowance();
      } else {
        startCooldown();
      }
    } catch (e: any) {
      // SE2 useTransactor already shows a toast; surface inline too.
      console.error("approve failed", e);
      setErrorMessage(getParsedError(e));
    }
  };

  const handleTip = async () => {
    if (!parsedAmount || !selectedCriterion || !connectedAddress) return;
    if (!snapshot.holders.length) {
      notification.error("Holder snapshot is empty.");
      return;
    }
    setErrorMessage(null);
    let winner: string;
    try {
      winner = selectedCriterion.evaluate(snapshot.holders, connectedAddress.toLowerCase());
    } catch (e: any) {
      notification.error("Could not pick a winner: " + (e?.message ?? "unknown"));
      return;
    }
    if (!isAddress(winner)) {
      notification.error("Computed winner is not a valid address: " + winner);
      return;
    }
    try {
      const hash = await writeAndOpen(() =>
        tipAsync({
          functionName: "tip",
          args: [winner as `0x${string}`, selectedCriterion.id, parsedAmount],
        }),
      );
      if (hash) {
        // Defer the reveal until the tx confirms via useWaitForTransactionReceipt.
        setPendingReveal({
          txHash: hash,
          winner: winner as `0x${string}`,
          criterionId: selectedCriterion.id,
          criterionName: selectedCriterion.name,
          amount: parsedAmount,
        });
        setPendingTxHash(hash);
      }
    } catch (e: any) {
      console.error("tip failed", e);
      setErrorMessage(getParsedError(e));
    }
  };

  const handleReset = () => {
    setReveal(null);
    setPendingReveal(null);
    setPendingTxHash(undefined);
    setSelectedId(null);
    setAmountStr("");
    setErrorMessage(null);
  };

  // ---------- render branches ----------
  // 1) Wallet connect — show RainbowKit's button (handles open modal).
  if (!isConnected) {
    return (
      <div className="card bg-base-100 shadow-sm w-full">
        <div className="card-body items-center text-center py-10">
          <h3 className="card-title">Connect your wallet to tip</h3>
          <p className="opacity-70 max-w-md text-sm">
            You&apos;ll pick a cause, enter a CLAWD amount, approve the contract, and tip a holder picked by the cause
            you select.
          </p>
          <ConnectButton.Custom>
            {({ openConnectModal, mounted }) => (
              <button
                type="button"
                className="btn btn-primary btn-lg mt-2"
                onClick={openConnectModal}
                disabled={!mounted}
              >
                Connect Wallet
              </button>
            )}
          </ConnectButton.Custom>
        </div>
      </div>
    );
  }

  // 2) Wrong chain — show ONLY a Switch button.
  if (!onCorrectChain) {
    return (
      <div className="card bg-base-100 shadow-sm w-full">
        <div className="card-body items-center text-center py-10">
          <h3 className="card-title text-error">Wrong network</h3>
          <p className="opacity-70 text-sm max-w-md">
            Clawd &amp; Effect lives on Base. Switch your wallet to continue.
          </p>
          <button
            type="button"
            className="btn btn-error btn-lg mt-2"
            onClick={() => switchChain({ chainId: SUPPORTED_CHAIN_ID })}
            disabled={isSwitching}
          >
            {isSwitching ? "Switching…" : "Switch to Base"}
          </button>
        </div>
      </div>
    );
  }

  // 3) Reveal screen — winner shown only after tx confirms.
  if (reveal) {
    return <RevealCard reveal={reveal} symbol={(tokenSymbol as string | undefined) ?? "CLAWD"} onAgain={handleReset} />;
  }

  // 4) Pending tx screen — winner intentionally hidden.
  if (pendingReveal) {
    return <MysteryCard symbol={(tokenSymbol as string | undefined) ?? "CLAWD"} />;
  }

  // 5) Default: criteria picker + (when one is selected) amount + button.
  const needsApproval = parsedAmount != null && allowance < parsedAmount;
  const insufficientBalance = parsedAmount != null && balance < parsedAmount;

  // Determine the single button to show. Order matters — only one rendered.
  let actionButton: React.ReactNode = null;
  if (selectedCriterion) {
    if (parsedAmount == null) {
      actionButton = (
        <button type="button" disabled className="btn btn-primary btn-block">
          Enter an amount
        </button>
      );
    } else if (insufficientBalance) {
      actionButton = (
        <button type="button" disabled className="btn btn-warning btn-block">
          Insufficient CLAWD balance
        </button>
      );
    } else if (isApproveMining) {
      actionButton = (
        <button type="button" disabled className="btn btn-primary btn-block">
          <span className="loading loading-spinner loading-sm" /> Approving…
        </button>
      );
    } else if (cooldown) {
      // Just-mined approve — keep button disabled while we re-read allowance.
      actionButton = (
        <button type="button" disabled className="btn btn-primary btn-block">
          <span className="loading loading-spinner loading-sm" /> Confirming approval…
        </button>
      );
    } else if (needsApproval) {
      actionButton = (
        <button type="button" className="btn btn-primary btn-block" onClick={handleApprove}>
          Approve {amountStr || "0"} CLAWD
        </button>
      );
    } else if (isTipMining) {
      actionButton = (
        <button type="button" disabled className="btn btn-primary btn-block">
          <span className="loading loading-spinner loading-sm" /> Tipping…
        </button>
      );
    } else {
      actionButton = (
        <button type="button" className="btn btn-primary btn-block" onClick={handleTip}>
          Send Tip
        </button>
      );
    }
  }

  return (
    <div className="card bg-base-100 shadow-sm w-full">
      <div className="card-body p-4 sm:p-6">
        <div className="flex items-baseline justify-between gap-2 mb-2">
          <h3 className="card-title text-base sm:text-lg">Pick a cause</h3>
          <span className="text-xs opacity-60">
            Balance:{" "}
            <span className="font-mono">
              {Number(formatUnits(balance, CLAWD_DECIMALS)).toLocaleString(undefined, {
                maximumFractionDigits: 4,
              })}{" "}
              {(tokenSymbol as string | undefined) ?? "CLAWD"}
            </span>
          </span>
        </div>

        <ul className="divide-y divide-base-300 max-h-[60vh] overflow-y-auto rounded-md bg-base-200/40">
          {ALL_CRITERIA.map(c => {
            const expanded = c.id === selectedId;
            return (
              <li key={c.id} className="px-3">
                <button
                  type="button"
                  className="w-full text-left py-3 flex items-start gap-3 group"
                  onClick={() => {
                    setSelectedId(prev => (prev === c.id ? null : c.id));
                    if (selectedId !== c.id) setAmountStr("");
                  }}
                  aria-expanded={expanded}
                >
                  <span className="badge badge-sm badge-outline shrink-0 mt-0.5 font-mono">
                    {String(c.id).padStart(2, "0")}
                  </span>
                  <span className="grow">
                    <span className="font-semibold block">{c.name}</span>
                    <span className="text-xs opacity-70 block">{c.description}</span>
                  </span>
                  <span aria-hidden className="text-lg opacity-50 group-hover:opacity-100">
                    {expanded ? "−" : "+"}
                  </span>
                </button>
                {expanded && (
                  <div className="pb-4 pt-1 grid gap-3">
                    <label className="form-control">
                      <span className="label-text text-xs mb-1">CLAWD tip amount</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        spellCheck={false}
                        placeholder="0.0"
                        className="input input-bordered w-full font-mono"
                        value={amountStr}
                        onChange={e => setAmountStr(e.target.value.replace(/[^0-9.]/g, ""))}
                      />
                      <span className="label-text-alt text-[10px] opacity-60 mt-1">
                        USD value not available — CLAWD has no oracle price feed.
                      </span>
                    </label>
                    {actionButton}
                    {errorMessage && (
                      <div role="alert" className="alert alert-error text-xs py-2 px-3 break-words whitespace-pre-wrap">
                        <span className="font-mono">{errorMessage}</span>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

// ---------- subcomponents ----------

const MysteryCard = ({ symbol }: { symbol: string }) => (
  <div className="card bg-base-100 shadow-sm w-full">
    <div className="card-body items-center text-center py-12">
      <div className="text-6xl mb-2 animate-pulse" aria-hidden>
        🐾
      </div>
      <h3 className="card-title">Picking a winner…</h3>
      <p className="opacity-70 max-w-md text-sm">
        Your tip is on its way to the chain. We&apos;ll reveal the {symbol} winner the moment the transaction confirms.
      </p>
      <span className="loading loading-dots loading-lg mt-4" />
    </div>
  </div>
);

const RevealCard = ({ reveal, symbol, onAgain }: { reveal: RevealState; symbol: string; onAgain: () => void }) => {
  const txUrl = `https://basescan.org/tx/${reveal.txHash}`;
  return (
    <div className="card bg-base-100 shadow-sm w-full">
      <div className="card-body items-center text-center py-10">
        <span className="badge badge-success badge-lg mb-2">Tip confirmed</span>
        <h3 className="card-title text-2xl">
          {Number(formatUnits(reveal.amount, CLAWD_DECIMALS)).toLocaleString(undefined, {
            maximumFractionDigits: 4,
          })}{" "}
          {symbol}
        </h3>
        <p className="opacity-70 text-sm">
          Cause: <span className="font-semibold">{reveal.criterionName}</span> (#
          {reveal.criterionId})
        </p>
        <div className="my-3 flex flex-col items-center gap-1">
          <span className="text-xs opacity-60">Winning address</span>
          <AddressView address={reveal.winner} />
        </div>
        <a href={txUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-ghost gap-1">
          View on Basescan
          <ArrowTopRightOnSquareIcon className="h-4 w-4" />
        </a>
        <div className="card-actions mt-4">
          <button type="button" className="btn btn-primary" onClick={onAgain}>
            Tip again
          </button>
        </div>
      </div>
    </div>
  );
};
