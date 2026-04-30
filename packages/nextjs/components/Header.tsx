"use client";

import React from "react";
import Link from "next/link";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";

/**
 * Site header. Single nav row with the app brand and the connect button.
 * No menu links: this dApp is one screen.
 */
export const Header = () => {
  return (
    <div className="sticky lg:static top-0 navbar bg-base-100 min-h-0 shrink-0 justify-between z-20 shadow-md shadow-secondary px-2 sm:px-4">
      <div className="navbar-start">
        <Link href="/" className="flex items-center gap-2 ml-2 mr-6 shrink-0">
          <span aria-hidden className="text-2xl">
            🐾
          </span>
          <div className="flex flex-col leading-tight">
            <span className="font-bold">Clawd &amp; Effect</span>
            <span className="text-xs opacity-70">A Hex Address Based Tipping Machine</span>
          </div>
        </Link>
      </div>
      <div className="navbar-end grow mr-2">
        <RainbowKitCustomConnectButton />
      </div>
    </div>
  );
};
