// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {IL2ToL2CrossDomainMessenger} from "./interfaces.sol";

interface IInteropPoW {
    function run(address workerAddress, uint256[] memory chainIds) external;
    function reportResults(bytes memory) external;

    event AllResults(bytes results);
}

interface IWorker {
    function run(uint256 returnDestination, address returnAddress) external;
}

contract InteropPoW is IInteropPoW {
    IL2ToL2CrossDomainMessenger xdm = IL2ToL2CrossDomainMessenger(0x4200000000000000000000000000000000000023);
    bytes public allResults; // currently this is append only

    function run(address workerAddress, uint256[] memory chainIds) public {
        for (uint8 i = 0; i < chainIds.length; i++) {
            runOnChain(workerAddress, chainIds[i]);
        }
    }

    function runOnChain(address workerAddress, uint256 chainId) public {
        // prepare the x-domain message
        bytes memory data =
            abi.encodeWithSelector(IL2ToL2CrossDomainMessenger.sendMessage.selector, block.chainid, this);

        // send the x-domain message
        xdm.sendMessage(chainId, workerAddress, data);
    }

    function reportResults(bytes memory results) public {
        // add results to global storage variable
        for (uint256 i = 0; i < results.length; i++) {
            allResults.push(results[i]);
        }

        // emit everything we have so far, ideally there are no duplicates
        // (the test or script running this should check)
        emit AllResults(allResults);
    }
}

contract Worker is IWorker {
    IL2ToL2CrossDomainMessenger xdm = IL2ToL2CrossDomainMessenger(0x4200000000000000000000000000000000000023);
    bytes32 constant difficulty = bytes32(uint256(2 ** 250 - 1));

    function run(uint256 returnDestination, address returnAddress) external {
        // Do the computation
        bytes memory results = compute();

        // Prepare the X-domain message
        bytes memory data = abi.encodeWithSelector(IL2ToL2CrossDomainMessenger.sendMessage.selector, results);

        // Send the X-domain message
        xdm.sendMessage(returnDestination, returnAddress, data);
    }

    function compute() public view returns (bytes memory) {
        bytes memory results;

        // compute the seed, this should be unique per chain
        bytes31 seed =
            bytes31(bytes32(keccak256(abi.encodePacked(block.chainid, block.timestamp, blockhash(block.number - 1)))));
        for (uint8 i = 0; i < 256 - 1; i++) {
            bytes memory preimage = bytes.concat(seed, bytes1(i)); // 32 bytes per solution
            bytes32 hash = keccak256(preimage);
            if (hash < difficulty) {
                results = bytes.concat(results, preimage);
            }
        }
        return results;
    }
}
