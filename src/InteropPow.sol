// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {IL2ToL2CrossDomainMessenger} from "./interfaces.sol";

interface IInteropPoW {
    function run() external;
    function reportResults(bytes memory) external;

    event AllResults(bytes results);
}

// contract InteropPoW is IInteropPoW {}

interface IWorker {
    function run() external;
}

contract Worker is IWorker {
    IL2ToL2CrossDomainMessenger xdm = IL2ToL2CrossDomainMessenger(0x4200000000000000000000000000000000000023);
    uint256 destination; // TODO this should be the on the instigating chain
    address target; // TODO this should be the InteropPoW contract

    bytes32 constant difficulty = bytes32(uint256(2 ** 250 - 1));

    function compute() public view returns (bytes memory) {
        bytes memory results;
        uint8 seed = uint8(block.timestamp + uint256(blockhash(block.number - 1)));
        for (uint8 i = 0; i < 256 - 1; i++) {
            bytes memory preimage = bytes.concat(bytes1(seed), bytes1(i));
            bytes32 hash = keccak256(preimage);
            if (hash < difficulty) {
                results = bytes.concat(results, preimage);
            }
        }
        return results;
    }

    function run() external {
        bytes memory results = compute();
        bytes4 selector = bytes4(keccak256("sendMessage(uint256,address,bytes)"));
        bytes memory data = abi.encodeWithSelector(selector, results);
        xdm.sendMessage(destination, target, data);
        // TODO send results back to InteropPow contract
    }
}
