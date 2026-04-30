import React from "react";
import { Address as AddressView } from "@scaffold-ui/components";
import { base } from "viem/chains";
import { SwitchTheme } from "~~/components/SwitchTheme";
import deployedContracts from "~~/contracts/deployedContracts";

const TIP_CONTRACT_ADDRESS = (deployedContracts as unknown as Record<number, Record<string, { address: string }>>)[
  base.id
].ClawdAndEffect.address as `0x${string}`;

/**
 * Site footer.
 *
 * Stripped of the SE2 default links/badges (no "Fork me", no BuidlGuidl link,
 * no native-currency price badge) — this is a production app, not a scaffold
 * showcase. We keep the theme switcher, a minimal credit line, and the
 * deployed contract address (rendered with the SE2 Address component so it
 * links to Basescan).
 */
export const Footer = () => {
  return (
    <div className="min-h-0 py-5 px-1 mb-11 lg:mb-0">
      <div>
        <div className="fixed flex justify-end items-center w-full z-10 p-4 bottom-0 left-0 pointer-events-none">
          <SwitchTheme className="pointer-events-auto" />
        </div>
      </div>
      <div className="w-full">
        <ul className="menu menu-horizontal w-full">
          <div className="flex flex-col items-center gap-1 text-sm w-full opacity-70">
            <div className="flex flex-wrap justify-center items-center gap-2">
              <span>Clawd & Effect</span>
              <span>·</span>
              <span>A Hex Address Based Tipping Machine</span>
              <span>·</span>
              <span>Made by a community member with help from LeftClaw Services beta</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span>Contract:</span>
              <AddressView address={TIP_CONTRACT_ADDRESS} size="xs" chain={base} onlyEnsOrAddress />
            </div>
          </div>
        </ul>
      </div>
    </div>
  );
};
