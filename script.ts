import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from 'dotenv';

dotenv.config();

// Load ABI and Bytecode from the neighboring Foundry project
const interopPoWContractArtifactPath = path.resolve(
    __dirname,
    "./out/InteropPoW.sol/InteropPoW.json"
);
const workerContractArtifactPath = path.resolve(
    __dirname,
    "./out/InteropPoW.sol/Worker.json"
);


// Read the artifact JSON file
const interopPoWContractArtifact = JSON.parse(fs.readFileSync(interopPoWContractArtifactPath, "utf8"));
const workerContractArtifact = JSON.parse(fs.readFileSync(workerContractArtifactPath, "utf8"));
const createXArtifact = JSON.parse(fs.readFileSync(workerContractArtifactPath, "utf8"));

// Replace with your own RPC URL and Private Key
const RPC_URL = "https://mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID";

// Ensure this account has ETH on both chains
const PRIVATE_KEY = process.env.PRIVATE_KEY as string; // 0x5f49333E8433A8fF9CdbD83Cf10184f20D8FDf65 


// Network Name: Interop Devnet 0
// Chain ID: 11473209
// Public RPC URL: https://interop-devnet-0.optimism.io/
// Sequencer RPC URL: https://interop-devnet-0.optimism.io/


// Network Name: Interop Devnet 1
// Chain ID: 21473209
// Public RPC URL: https://interop-devnet-1.optimism.io/
// Sequencer RPC URL: https://interop-devnet-1.optimism.io/

async function main() {
    const provider0 = new ethers.JsonRpcProvider("https://interop-devnet-0.optimism.io")
    const provider1 = new ethers.JsonRpcProvider("https://interop-devnet-1.optimism.io")

    // Connect to the Ethereum network
    const wallet0 = new ethers.Wallet(PRIVATE_KEY, provider0);
    const wallet1 = new ethers.Wallet(PRIVATE_KEY, provider1);

    console.log("balance is ", ethers.formatEther(await provider0.getBalance(wallet0.address)), "on chain 0")

    // OPStack chains have a CreateX preinstall at 0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed
    // we can use function deployCreate2(bytes32 salt, bytes memory initCode) public payable returns (address newContract)

    const functionAbi =
        [
            "function computeCreate2Address(bytes32,bytes32) view returns (address)",
            "function deployCreate2(bytes32,bytes) payable returns (address)",
        ]

    const createX0 = new ethers.Contract("0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed", functionAbi, wallet0)
    const createX1 = new ethers.Contract("0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed", functionAbi, wallet1)
    const salt = wallet0.address + "000000000000000000000000" // to conform with CreateX salt requirements.
    console.log("salt", salt)
    const guardedSalt = ethers.keccak256("0x000000000000000000000000" + wallet0.address.slice(2) + salt.slice(2))

    const initCodeHash = ethers.keccak256(interopPoWContractArtifact.bytecode.object)

    const interopPoWAddress = await createX0.computeCreate2Address(guardedSalt, initCodeHash)
    let codeAt = await provider0.getCode(interopPoWAddress)
    if (codeAt == "0x") {
        const tx = await createX0.deployCreate2(salt, interopPoWContractArtifact.bytecode.object)
        await tx.wait()
        console.log("interopPoW deployed to ", interopPoWAddress, " on chain 0")
    } else {
        console.log("interopPoW already deployed to ", interopPoWAddress, " on chain 0")
    }

    const workerAddress = await createX0.computeCreate2Address(guardedSalt, ethers.keccak256(workerContractArtifact.bytecode.object))
    codeAt = await provider0.getCode(workerAddress)
    if (codeAt == "0x") {
        const tx = await createX0.deployCreate2(salt, workerContractArtifact.bytecode.object)
        await tx.wait()
        console.log("worker deployed to ", workerAddress, "on chain 0")
    } else {
        console.log("worker already deployed to ", workerAddress, "on chain 0")
    }

    codeAt = await provider1.getCode(workerAddress)
    createX0.connect(wallet1)
    if (codeAt == "0x") {
        const tx = await createX1.deployCreate2(salt, workerContractArtifact.bytecode.object)
        await tx.wait()
        console.log("worker deployed to ", workerAddress, "on chain 1")
    } else {
        console.log("worker already deployed to ", workerAddress, " on chain 1")
    }

    // const worker0 = new ethers.Contract(workerAddress, workerContractArtifact.abi, wallet0)
    // const worker1 = new ethers.Contract(workerAddress, workerContractArtifact.abi, wallet1)

    // call entrypoint
    const interopPoW = new ethers.Contract(interopPoWAddress, interopPoWContractArtifact.abi, wallet0)
    const tx = await interopPoW.run(workerAddress, [11473209, 21473209]) // launch everything
    // const tx = await interopPoW.run(workerAddress, [21473209]) // launch only on the remote chain. the xdm does not allow sending to your own chain
    console.log("interopPoW.run() tx launched with hash", tx.hash)
    await tx.wait()
    console.log("launched job...")

    // wait for event
    // event subscriptions are not supported, so we resort
    // to short polling
    console.log("polling for state every 1s...")

    let counter = 0;
    const interval = setInterval(async () => {
        // Code to run every 1 second
        console.log("Querying results...", counter++);

        // const log0 = await worker0.localResultLog()
        // console.log("worker1 local reusult:", log0)
        // const log1 = await worker1.localResultLog()
        // console.log("worker1 local reusult:", log1)

        const aR = await interopPoW.allResults()
        console.log("allResults:", aR)

        // Stop the interval after 10 executions
        if (counter >= 10) {
            clearInterval(interval);
            console.log("Finished after 10 seconds");
        }
    }, 1000); // 1000 ms = 1 second

}

main().catch((error) => {
    console.error("Error:", error);
});
