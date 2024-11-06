// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

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
    bytes32 constant difficulty = bytes32(uint256(2 ** 250 - 1));

    function compute() public view returns (bytes memory) {
        // uint8 seed = uint8(uint256(blockhash(block.number - 1))); // deterministic
        uint8 seed = uint8(block.timestamp); // random
        bytes memory results; // 2 bytes per preimage
        for (uint8 i = 0; i < 256 - 1; i++) {
            bytes memory preimage = bytes.concat(bytes1(seed), bytes1(i));
            bytes32 hash = keccak256(preimage);
            if (hash < difficulty) {
                results = bytes.concat(results, preimage);
            }
        }
        return results;
        // xdm.send(bytes)
    }

    function run() external view {
        bytes memory results = compute();
        // TODO send results back to InteropPow contract
    }
}
