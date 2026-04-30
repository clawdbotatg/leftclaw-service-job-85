//SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
// import { DeployYourContract } from "./DeployYourContract.s.sol";
import { DeployClawdAndEffect } from "./DeployClawdAndEffect.s.sol";

/**
 * @notice Main deployment script for all contracts
 * @dev Run this when you want to deploy multiple contracts at once
 *
 * Example: yarn deploy # runs this script(without`--file` flag)
 */
contract DeployScript is ScaffoldETHDeploy {
  function run() external {
    // Deploys all your contracts sequentially
    // Add new deployments here when needed

    // Skip default DeployYourContract on Base — only ClawdAndEffect is in scope.
    // DeployYourContract deployYourContract = new DeployYourContract();
    // deployYourContract.run();

    DeployClawdAndEffect deployClawdAndEffect = new DeployClawdAndEffect();
    deployClawdAndEffect.run();

    // Deploy another contract
    // DeployMyContract myContract = new DeployMyContract();
    // myContract.run();
  }
}