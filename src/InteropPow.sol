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
    bytes32 constant difficulty = bytes32(uint256(2 ** 64 - 1));

    function compute() public view returns (bytes memory) {
        bytes32 seed = blockhash(block.number - 1);
        bytes memory results;
        for (uint256 i = 0; i < 1000; i++) {
            bytes32 hash = keccak256(abi.encodePacked(seed, i));
            if (hash < difficulty) {
                results = bytes.concat(results, seed);
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
