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

    const relayorAddress = "0xBD4F00cb05C5a5843889746Bc139A659370973c9"

    // const reUpRelayorTx = {
    //     to: "0xBD4F00cb05C5a5843889746Bc139A659370973c9",
    //     value: ethers.parseEther("0.1"),
    // };

    // const tX = await wallet0.sendTransaction(reUpRelayorTx)
    // console.log("replenshing relayor on chain 1, tx with hash", tX.hash)
    // await tX.wait()


    console.log("⚖️ User balance is ", ethers.formatEther(await provider0.getBalance(wallet0.address)), "on chain 0")
    console.log("⚖️ Relayor balance is ", ethers.formatEther(await provider0.getBalance(relayorAddress)), "on chain 0")
    console.log("⚖️ Relayor balance is ", ethers.formatEther(await provider1.getBalance(relayorAddress)), "on chain 1")


    // OPStack chains have a CreateX preinstall at 0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed
    // we can use function deployCreate2(bytes32 salt, bytes memory initCode) public payable returns (address newContract)

    const functionAbi =
        [
            "function computeCreate2Address(bytes32,bytes32) view returns (address)",
            "function deployCreate2(bytes32,bytes) payable returns (address)",
        ]

    const createX0 = new ethers.Contract("0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed", functionAbi, wallet0)
    const createX1 = new ethers.Contract("0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed", functionAbi, wallet1)

    // Increment this to get a fresh deployment even when source code is unchanged. 
    const salt = wallet0.address + "000000000000000000000000" // to conform with CreateX salt requirements.


    console.log("🧂 CREATE2 deployment salt:", salt)
    const guardedSalt = ethers.keccak256("0x000000000000000000000000" + wallet0.address.slice(2) + salt.slice(2))

    const initCodeHash = ethers.keccak256(interopPoWContractArtifact.bytecode.object)

    const interopPoWAddress = await createX0.computeCreate2Address(guardedSalt, initCodeHash)
    let codeAt = await provider0.getCode(interopPoWAddress)
    if (codeAt == "0x") {
        const tx = await createX0.deployCreate2(salt, interopPoWContractArtifact.bytecode.object)
        await tx.wait()
        console.log("📜 interopPoW deployed to ", interopPoWAddress, " on chain 0")
    } else {
        console.log("📜 interopPoW already deployed to ", interopPoWAddress, " on chain 0")
    }

    const workerAddress = await createX0.computeCreate2Address(guardedSalt, ethers.keccak256(workerContractArtifact.bytecode.object))
    codeAt = await provider0.getCode(workerAddress)
    if (codeAt == "0x") {
        const tx = await createX0.deployCreate2(salt, workerContractArtifact.bytecode.object)
        await tx.wait()
        console.log("📜 worker deployed to ", workerAddress, "on chain 0")
    } else {
        console.log("📜 worker already deployed to ", workerAddress, "on chain 0")
    }

    codeAt = await provider1.getCode(workerAddress)
    createX0.connect(wallet1)
    if (codeAt == "0x") {
        const tx = await createX1.deployCreate2(salt, workerContractArtifact.bytecode.object)
        await tx.wait()
        console.log("📜 worker deployed to ", workerAddress, "on chain 1")
    } else {
        console.log("📜 worker already deployed to ", workerAddress, " on chain 1")
    }

    const worker0 = new ethers.Contract(workerAddress, workerContractArtifact.abi, wallet0)
    const worker1 = new ethers.Contract(workerAddress, workerContractArtifact.abi, wallet1)

    // call entrypoint
    const interopPoW = new ethers.Contract(interopPoWAddress, interopPoWContractArtifact.abi, wallet0)
    const tx = await interopPoW.run(workerAddress, [11473209, 21473209], {
        gasLimit: 800_000,
    }) // launch everything
    // const tx = await interopPoW.run(workerAddress, [21473209]) // launch only on the remote chain. the xdm does not allow sending to your own chain
    console.log("🗳️ interopPoW.run() tx launching with hash", tx.hash)
    await tx.wait()
    console.log("⚒️ tx confirmed")


    var log0: string
    var log1: string
    var aR: string
    async function queryState() {
        console.log("\nQuerying results...", period * counter++, "ms");

        log0 = await worker0.localResultLog()
        console.log("worker0 (LOCAL) cached results have length:", log0.slice(2).length)

        log1 = await worker1.localResultLog()
        console.log("worker1 (REMOTE) cached results have length:", log1.slice(2).length)

        aR = await interopPoW.allResults()
        console.log("InteropPoW.allResults has length:", aR.slice(2).length)
    }
    // wait for event
    // event subscriptions are not supported, so we resort
    // to short polling
    const period = 500; // ms
    console.log("🗣️ polling for state every", period, "ms...")
    let counter = 0;

    async function runInterval() {
        if (counter > 20 ||
            aR && log0 && log1 && aR.slice(2).length == log0.slice(2).length + log1.slice(2).length) {
            return
        }
        try {
            await queryState();
        } catch (error) {
            console.error("Error:", error);
        } finally {
            counter++
            setTimeout(runInterval, period); // Schedule the next run after completion
        }
    }

    // Start the first interval
    runInterval();

}

main().catch((error) => {
    console.error("Error:", error);
});
