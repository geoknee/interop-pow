// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";
import {Worker} from "../src/InteropPoW.sol";

contract WorkerTest is Test {
    Worker public w;

    function setUp() public {
        w = new Worker();
    }

    function test_compute() public {
        for (uint8 i = 0; i < 256 - 1; i++) {
            vm.warp(i);
            bytes memory results = w.compute();
            console.log("found %s valid preimages", results.length / 32);
        }
    }
}
