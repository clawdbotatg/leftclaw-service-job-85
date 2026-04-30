"use client";

import { useEffect, useState } from "react";
import type { NextPage } from "next";
import { Disclaimers } from "~~/components/clawd/Disclaimers";
import { HowItWorks } from "~~/components/clawd/HowItWorks";
import { TipFlow } from "~~/components/clawd/TipFlow";

type Snapshot = {
  snapshotDate: string;
  snapshotBlock: number;
  tokenAddress: string;
  holderCount: number;
  holders: string[];
};

const Home: NextPage = () => {
  // We fetch the snapshot client-side from /holders.json. It lives in public/
  // so the static export ships it as a sibling file. This keeps the JS bundle
  // small and lets us update the snapshot without rebuilding the whole site.
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("./holders.json", { cache: "force-cache" })
      .then(r => {
        if (!r.ok) throw new Error(`holders.json: HTTP ${r.status}`);
        return r.json();
      })
      .then((j: Snapshot) => {
        if (cancelled) return;
        if (!Array.isArray(j.holders) || j.holders.length === 0) {
          throw new Error("holders.json is empty");
        }
        setSnapshot(j);
      })
      .catch(e => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex items-center flex-col grow w-full">
      <div className="w-full max-w-3xl px-4 sm:px-6 py-8 flex flex-col gap-5">
        <header className="text-center mt-2">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-1">Clawd & Effect</h1>
          <p className="text-lg sm:text-xl opacity-80 italic m-0">A Hex Address Based Tipping Machine</p>
          <p className="opacity-70 max-w-xl mx-auto mt-3 text-sm sm:text-base">
            Pick a cause — a fun reason based on hex address patterns. Tip some CLAWD. See who gets it.
          </p>
        </header>

        <HowItWorks />

        {snapshot && <Disclaimers snapshotDate={snapshot.snapshotDate} holderCount={snapshot.holderCount} />}

        {error && (
          <div className="alert alert-error">
            <span>Failed to load holder snapshot: {error}</span>
          </div>
        )}

        {snapshot ? (
          <TipFlow snapshot={snapshot} />
        ) : !error ? (
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body items-center">
              <span className="loading loading-dots loading-md" />
              <span className="text-sm opacity-70">Loading holder snapshot…</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default Home;
