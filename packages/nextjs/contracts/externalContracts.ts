import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

/**
 * External (already-deployed, not built by us) contracts the dApp reads or
 * writes through Scaffold hooks.
 *
 * The CLAWD ABI here is the full OZ v5 ERC-20 surface that the frontend
 * actually uses, plus every custom error from `IERC20Errors`,
 * `Ownable`, `ERC20Pausable`, and `ERC20Permit` so revert reasons decode
 * correctly when surfaced through `getParsedError`. Per CLAUDE.md ship-blocker
 * checklist, the ABI must contain every error type for revert decoding to
 * work — `try { ... } catch (e) { getParsedError(e) }` only translates errors
 * whose definitions are present in the ABI.
 */
const externalContracts = {
  8453: {
    CLAWD: {
      address: "0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07",
      abi: [
        // ----- IERC20 / IERC20Metadata views & writes -----
        {
          type: "function",
          name: "name",
          inputs: [],
          outputs: [{ name: "", type: "string", internalType: "string" }],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "symbol",
          inputs: [],
          outputs: [{ name: "", type: "string", internalType: "string" }],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "decimals",
          inputs: [],
          outputs: [{ name: "", type: "uint8", internalType: "uint8" }],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "totalSupply",
          inputs: [],
          outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "balanceOf",
          inputs: [{ name: "account", type: "address", internalType: "address" }],
          outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "allowance",
          inputs: [
            { name: "owner", type: "address", internalType: "address" },
            { name: "spender", type: "address", internalType: "address" },
          ],
          outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "approve",
          inputs: [
            { name: "spender", type: "address", internalType: "address" },
            { name: "value", type: "uint256", internalType: "uint256" },
          ],
          outputs: [{ name: "", type: "bool", internalType: "bool" }],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "transfer",
          inputs: [
            { name: "to", type: "address", internalType: "address" },
            { name: "value", type: "uint256", internalType: "uint256" },
          ],
          outputs: [{ name: "", type: "bool", internalType: "bool" }],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "transferFrom",
          inputs: [
            { name: "from", type: "address", internalType: "address" },
            { name: "to", type: "address", internalType: "address" },
            { name: "value", type: "uint256", internalType: "uint256" },
          ],
          outputs: [{ name: "", type: "bool", internalType: "bool" }],
          stateMutability: "nonpayable",
        },
        // ----- Events (Transfer + Approval) -----
        {
          type: "event",
          name: "Transfer",
          inputs: [
            { name: "from", type: "address", indexed: true, internalType: "address" },
            { name: "to", type: "address", indexed: true, internalType: "address" },
            { name: "value", type: "uint256", indexed: false, internalType: "uint256" },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "Approval",
          inputs: [
            { name: "owner", type: "address", indexed: true, internalType: "address" },
            { name: "spender", type: "address", indexed: true, internalType: "address" },
            { name: "value", type: "uint256", indexed: false, internalType: "uint256" },
          ],
          anonymous: false,
        },
        // ----- IERC20Errors (OZ v5) — required for revert decoding -----
        {
          type: "error",
          name: "ERC20InsufficientBalance",
          inputs: [
            { name: "sender", type: "address", internalType: "address" },
            { name: "balance", type: "uint256", internalType: "uint256" },
            { name: "needed", type: "uint256", internalType: "uint256" },
          ],
        },
        {
          type: "error",
          name: "ERC20InvalidSender",
          inputs: [{ name: "sender", type: "address", internalType: "address" }],
        },
        {
          type: "error",
          name: "ERC20InvalidReceiver",
          inputs: [{ name: "receiver", type: "address", internalType: "address" }],
        },
        {
          type: "error",
          name: "ERC20InsufficientAllowance",
          inputs: [
            { name: "spender", type: "address", internalType: "address" },
            { name: "allowance", type: "uint256", internalType: "uint256" },
            { name: "needed", type: "uint256", internalType: "uint256" },
          ],
        },
        {
          type: "error",
          name: "ERC20InvalidApprover",
          inputs: [{ name: "approver", type: "address", internalType: "address" }],
        },
        {
          type: "error",
          name: "ERC20InvalidSpender",
          inputs: [{ name: "spender", type: "address", internalType: "address" }],
        },
        // ----- Common OZ Ownable / Pausable / Permit errors (defensive — CLAWD
        // is a community token whose exact OZ extensions we don't control. If
        // the on-chain contract doesn't emit these, having them in the ABI is
        // harmless; if it does, they decode correctly.) -----
        {
          type: "error",
          name: "OwnableUnauthorizedAccount",
          inputs: [{ name: "account", type: "address", internalType: "address" }],
        },
        {
          type: "error",
          name: "OwnableInvalidOwner",
          inputs: [{ name: "owner", type: "address", internalType: "address" }],
        },
        {
          type: "error",
          name: "EnforcedPause",
          inputs: [],
        },
        {
          type: "error",
          name: "ExpectedPause",
          inputs: [],
        },
        {
          type: "error",
          name: "ERC2612ExpiredSignature",
          inputs: [{ name: "deadline", type: "uint256", internalType: "uint256" }],
        },
        {
          type: "error",
          name: "ERC2612InvalidSigner",
          inputs: [
            { name: "signer", type: "address", internalType: "address" },
            { name: "owner", type: "address", internalType: "address" },
          ],
        },
        // SafeERC20 wrapper error — surfaced when SafeERC20.safeTransferFrom
        // detects a non-standard ERC20 (returns false / no boolean). Defensive.
        {
          type: "error",
          name: "SafeERC20FailedOperation",
          inputs: [{ name: "token", type: "address", internalType: "address" }],
        },
      ],
    },
  },
} as const;

export default externalContracts satisfies GenericContractsDeclaration;
