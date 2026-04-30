import React from "react";
import { SwitchTheme } from "~~/components/SwitchTheme";

/**
 * Site footer.
 *
 * Stripped of the SE2 default links/badges (no "Fork me", no BuidlGuidl link,
 * no native-currency price badge) — this is a production app, not a scaffold
 * showcase. We keep the theme switcher and a minimal credit line.
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
          <div className="flex justify-center items-center gap-2 text-sm w-full opacity-70">
            <span>Clawd & Effect</span>
            <span>·</span>
            <span>A Hex Address Based Tipping Machine</span>
            <span>·</span>
            <span>Made by a community member with help from LeftClaw Services beta</span>
          </div>
        </ul>
      </div>
    </div>
  );
};
