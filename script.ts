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
const createXContractArtifactPath = path.resolve(
    __dirname,
    "./CreateX.json"
);

// Read the artifact JSON file
const interopPoWContractArtifact = JSON.parse(fs.readFileSync(interopPoWContractArtifactPath, "utf8"));
const workerContractArtifact = JSON.parse(fs.readFileSync(workerContractArtifactPath, "utf8"));
const createXArtifact = JSON.parse(fs.readFileSync(workerContractArtifactPath, "utf8"));

// Replace with your own RPC URL and Private Key
const RPC_URL = "https://mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID";

// Ensure this account has ETH on both chains
const PRIVATE_KEY = "0x7aed2cae4c5eaa08342edd3905e029981fce3daed9437729c4c56952ce840b18"; // 0x5f49333E8433A8fF9CdbD83Cf10184f20D8FDf65 


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

    // OPStack chains have a CreateX preinstall at 0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed
    // we can use function deployCreate2(bytes32 salt, bytes memory initCode) public payable returns (address newContract)

    const createX0 = new ethers.Contract("0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed", createXArtifact.abi, wallet0)
    console.log(createX0)
    const createX1 = new ethers.Contract("0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed", createXArtifact.abi, wallet1)
    const salt = 0
    const interopPoWAddress = await (await createX0.deployCreate2(salt, interopPoWContractArtifact.initCode, wallet0)).wait()
    console.log("interopPoW deployed to ", interopPoWAddress)

    const worker0Address = await (await createX0.deployCreate2(salt, workerContractArtifact.initCode)).wait()
    const worker1Address = await (await createX1.deployCreate2(salt, workerContractArtifact.initCode)).wait()
    console.log("workers deployed to ", worker0Address, worker1Address)
    // TODO we need both addresses to be the same, and actually we want to deploy them first and pass in the address to the 
    // entrypoint at either construction or runtime.

    // call entrypoint
    const interopPoW = new ethers.Contract(interopPoWAddress, interopPoWContractArtifact.abi)
    await interopPoW.run(worker0Address, [0, 1]) // launch everything



    // wait for event
    await interopPoW.on("AllResults", x => console.log(x))
}

main().catch((error) => {
    console.error("Error:", error);
});
