// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {Worker} from "../src/InteropPoW.sol";

contract InteropPoWScript is Script {
    Worker public w;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        bytes memory results = w.compute();

        vm.stopBroadcast();
    }
}
