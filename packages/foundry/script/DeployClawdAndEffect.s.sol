// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./DeployHelpers.s.sol";
import { ClawdAndEffect } from "../contracts/ClawdAndEffect.sol";

/**
 * @notice Deploy script for ClawdAndEffect contract.
 * @dev    The CLAWD token address is hard-coded as the canonical Base mainnet
 *         CLAWD ERC20. The contract itself does not hard-code the token; it
 *         is passed in via the constructor so unit tests can stub it. Only
 *         this deploy script knows the live address.
 *
 * Example:
 *   yarn deploy --file DeployClawdAndEffect.s.sol --network base
 */
contract DeployClawdAndEffect is ScaffoldETHDeploy {
    /// @notice Canonical CLAWD ERC20 token on Base mainnet.
    address constant CLAWD_TOKEN = 0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07;

    function run() external ScaffoldEthDeployerRunner {
        new ClawdAndEffect(CLAWD_TOKEN);
    }
}
