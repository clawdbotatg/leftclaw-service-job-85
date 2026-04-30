// SPDX-License-Identifier: MIT
pragma solidity >=0.8.20 <0.9.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title ClawdAndEffect
 * @notice Minimal pass-through tip contract for the CLAWD ERC20 token.
 *         A sender approves this contract to spend their CLAWD, then calls
 *         `tip(winner, criteriaId, amount)`. The contract simply pulls the
 *         tokens from the sender and forwards them to the winner, emitting an
 *         event so off-chain consumers can index tips by sender / winner /
 *         criteria.
 *
 *         The contract holds no funds, has no admin, no upgradeability,
 *         no pause switch, and no fallback / receive — every call is a clean
 *         transferFrom from sender to winner.
 */
contract ClawdAndEffect {
    using SafeERC20 for IERC20;

    /// @notice The CLAWD ERC20 token this contract forwards tips for.
    IERC20 public immutable clawdToken;

    /// @notice Emitted after a successful tip transfer.
    /// @param sender     The tipper (msg.sender).
    /// @param winner     The recipient of the tip.
    /// @param criteriaId Off-chain-defined category id for the tip.
    /// @param amount     Amount of CLAWD (in token base units) tipped.
    /// @param timestamp  Block timestamp at which the tip was emitted.
    event Tip(
        address indexed sender,
        address indexed winner,
        uint8 criteriaId,
        uint256 amount,
        uint256 timestamp
    );

    error ZeroAddressWinner();
    error ZeroAddressToken();
    error ZeroAmount();

    /// @param _clawdToken Address of the CLAWD ERC20 token contract.
    constructor(address _clawdToken) {
        if (_clawdToken == address(0)) revert ZeroAddressToken();
        clawdToken = IERC20(_clawdToken);
    }

    /**
     * @notice Tip `amount` CLAWD from msg.sender to `winner`.
     * @dev    Requires the caller to have previously approved this contract
     *         for at least `amount` CLAWD via the token's `approve`. Uses
     *         SafeERC20 so non-standard ERC20s (returning false / reverting)
     *         both cause this call to revert. Event is emitted only after the
     *         transfer succeeds.
     * @param winner     Recipient of the tip. Must not be the zero address.
     * @param criteriaId Off-chain-defined category id (0-255).
     * @param amount     CLAWD amount in base units. Must be non-zero.
     */
    function tip(address winner, uint8 criteriaId, uint256 amount) external {
        if (winner == address(0)) revert ZeroAddressWinner();
        if (amount == 0) revert ZeroAmount();

        clawdToken.safeTransferFrom(msg.sender, winner, amount);

        emit Tip(msg.sender, winner, criteriaId, amount, block.timestamp);
    }
}
