import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

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

// Replace with your own RPC URL and Private Key
const RPC_URL = "https://mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID";

// TODO generate a private key, ensure it has ETH on both chains
const PRIVATE_KEY = "YOUR_PRIVATE_KEY"; // use same one on both chains


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

    // deploy entrypoint contract to chain 0
    const interopPoWFactory = new ethers.ContractFactory(interopPoWContractArtifact.abi, interopPoWContractArtifact.bytecode, wallet0);
    console.log("Deploying contract to chain 0...");
    const interopPoW = await interopPoWFactory.deploy() as ethers.Contract & { run: () => Promise<void> };
    await interopPoW.waitForDeployment()
    console.log(`Contract deployed at: ${await interopPoW.getAddress()} `);

    // deploy worker to chain 0
    const workerFactory0 = new ethers.ContractFactory(interopPoWContractArtifact.abi, interopPoWContractArtifact.bytecode, wallet0);
    console.log("Deploying contract to chain 0...");
    const worker0 = await workerFactory0.deploy();
    await worker0.waitForDeployment()
    console.log(`Contract deployed at: ${await worker0.getAddress()} `);

    // deploy worker to chain 1
    const workerFactory1 = new ethers.ContractFactory(interopPoWContractArtifact.abi, interopPoWContractArtifact.bytecode, wallet1);
    console.log("Deploying contract to chain 0...");
    const worker1 = await workerFactory1.deploy();
    await worker1.waitForDeployment()
    console.log(`Contract deployed at: ${await worker1.getAddress()} `);

    // call entrypoint
    interopPoW.connect(wallet0);
    await interopPoW.run()

    // wait for event


}

main().catch((error) => {
    console.error("Error:", error);
});
