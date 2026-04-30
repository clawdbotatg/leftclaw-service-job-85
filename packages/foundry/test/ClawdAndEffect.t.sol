// SPDX-License-Identifier: MIT
pragma solidity >=0.8.20 <0.9.0;

import { Test } from "forge-std/Test.sol";
import { ClawdAndEffect } from "../contracts/ClawdAndEffect.sol";
import { ERC20Mock } from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";
import { IERC20Errors } from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

contract ClawdAndEffectTest is Test {
    ClawdAndEffect internal clawdAndEffect;
    ERC20Mock internal token;

    address internal sender = address(0xA11CE);
    address internal winner = address(0xB0B);

    // Re-declared here so vm.expectEmit can match against it.
    event Tip(
        address indexed sender,
        address indexed winner,
        uint8 criteriaId,
        uint256 amount,
        uint256 timestamp
    );

    function setUp() public {
        token = new ERC20Mock();
        clawdAndEffect = new ClawdAndEffect(address(token));

        // Fund the sender with plenty of mock CLAWD.
        token.mint(sender, 1_000 ether);
    }

    /// 1. Happy path: balances move and the Tip event is emitted with the
    ///    correct sender / winner / criteriaId / amount / timestamp.
    function testTipHappyPath() public {
        uint256 amount = 100 ether;
        uint8 criteriaId = 7;

        vm.prank(sender);
        token.approve(address(clawdAndEffect), amount);

        uint256 senderBalBefore = token.balanceOf(sender);
        uint256 winnerBalBefore = token.balanceOf(winner);

        // Pin a deterministic timestamp so we can assert it in the event.
        vm.warp(1_700_000_000);

        vm.expectEmit(true, true, false, true, address(clawdAndEffect));
        emit Tip(sender, winner, criteriaId, amount, block.timestamp);

        vm.prank(sender);
        clawdAndEffect.tip(winner, criteriaId, amount);

        assertEq(token.balanceOf(sender), senderBalBefore - amount, "sender balance");
        assertEq(token.balanceOf(winner), winnerBalBefore + amount, "winner balance");
        // The tip contract must never hold funds.
        assertEq(token.balanceOf(address(clawdAndEffect)), 0, "contract holds no balance");
    }

    /// 2. Revert when amount == 0.
    function testTipRevertsOnZeroAmount() public {
        vm.prank(sender);
        token.approve(address(clawdAndEffect), 100 ether);

        vm.expectRevert(ClawdAndEffect.ZeroAmount.selector);
        vm.prank(sender);
        clawdAndEffect.tip(winner, 1, 0);
    }

    /// 3. Revert when winner == address(0).
    function testTipRevertsOnZeroWinner() public {
        vm.prank(sender);
        token.approve(address(clawdAndEffect), 100 ether);

        vm.expectRevert(ClawdAndEffect.ZeroAddressWinner.selector);
        vm.prank(sender);
        clawdAndEffect.tip(address(0), 1, 100 ether);
    }

    /// 4. Revert when sender has not approved (allowance = 0). The ERC20
    ///    revert (OZ v5 ERC20InsufficientAllowance custom error) must
    ///    propagate up through ClawdAndEffect.
    function testTipRevertsOnZeroAllowance() public {
        // Sender has tokens but never called approve.
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientAllowance.selector,
                address(clawdAndEffect),
                0,
                100 ether
            )
        );
        vm.prank(sender);
        clawdAndEffect.tip(winner, 1, 100 ether);
    }

    /// 5. Revert when sender's balance < amount, even with sufficient
    ///    allowance. ERC20InsufficientBalance must propagate.
    function testTipRevertsOnInsufficientBalance() public {
        address pauper = address(0xDEAD);
        // pauper has zero CLAWD but approves a huge allowance.
        vm.prank(pauper);
        token.approve(address(clawdAndEffect), type(uint256).max);

        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientBalance.selector,
                pauper,
                0,
                1 ether
            )
        );
        vm.prank(pauper);
        clawdAndEffect.tip(winner, 1, 1 ether);
    }

    /// 6. Multiple tips in sequence work — the contract is stateless so
    ///    consecutive calls (with sufficient allowance) all succeed and
    ///    balances accumulate as expected.
    function testMultipleTipsInSequence() public {
        uint256 amount1 = 10 ether;
        uint256 amount2 = 25 ether;
        uint256 amount3 = 5 ether;
        uint256 total = amount1 + amount2 + amount3;

        vm.prank(sender);
        token.approve(address(clawdAndEffect), total);

        address winner2 = address(0xCAFE);

        uint256 senderBefore = token.balanceOf(sender);

        vm.startPrank(sender);
        clawdAndEffect.tip(winner, 1, amount1);
        clawdAndEffect.tip(winner2, 2, amount2);
        clawdAndEffect.tip(winner, 3, amount3);
        vm.stopPrank();

        assertEq(token.balanceOf(sender), senderBefore - total, "sender drained by total");
        assertEq(token.balanceOf(winner), amount1 + amount3, "winner accumulates two tips");
        assertEq(token.balanceOf(winner2), amount2, "winner2 receives one tip");
        assertEq(token.balanceOf(address(clawdAndEffect)), 0, "contract still holds nothing");
        // Allowance should be fully consumed.
        assertEq(token.allowance(sender, address(clawdAndEffect)), 0, "allowance fully spent");
    }

    /// Constructor sanity: zero address token reverts.
    function testConstructorRevertsOnZeroToken() public {
        vm.expectRevert(ClawdAndEffect.ZeroAddressWinner.selector);
        new ClawdAndEffect(address(0));
    }
}
