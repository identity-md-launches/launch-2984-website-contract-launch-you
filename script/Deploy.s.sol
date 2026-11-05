// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {WheelhouseRounds} from "../src/WheelhouseRounds.sol";

/// @notice Operator dry run; the network deployer supplies the requester-owned address.
/// @dev No keys, environment or broadcasting. Configuration is a separate owner action.
contract Deploy {
    error WrongChain();

    function run(address launchOwner) external returns (WheelhouseRounds deployed) {
        return deploy(launchOwner);
    }

    function deploy(address launchOwner) public returns (WheelhouseRounds deployed) {
        if (block.chainid != 11_155_111) revert WrongChain();
        deployed = new WheelhouseRounds(launchOwner);
    }
}
