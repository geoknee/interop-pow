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

    console.log(ethers.formatEther(await provider0.getBalance(wallet0.address)))

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

    // 0x0000000000000000000000005f49333E8433A8fF9CdbD83Cf10184f20D8FDf650x5f49333E8433A8fF9CdbD83Cf10184f20D8FDf65000000000000000000000000
    // 0x0000000000000000000000005f49333E8433A8fF9CdbD83Cf10184f20D8FDf65
    // 0xbebebebebebebebebebebebebebebebebebebebeff1212121212121212121212
    // 0x5f49333E8433A8fF9CdbD83Cf10184f20D8FDf65000000000000000000000000


    const initCodeHash = ethers.keccak256(interopPoWContractArtifact.bytecode.object)

    const interopPoWAddress = await createX0.computeCreate2Address(salt, initCodeHash)
    let codeAt = await provider0.getCode(interopPoWAddress)
    console.log(codeAt)
    if (codeAt == "0x") {
        const tx = await createX0.deployCreate2(guardedSalt, interopPoWContractArtifact.bytecode.object)
        await tx.wait()
        console.log("interopPoW deployed to ", interopPoWAddress)
    } else {
        console.log("interopPoW already deployed to ", interopPoWAddress)
    }

    const workerAddress = await createX0.computeCreate2Address(guardedSalt, ethers.keccak256(workerContractArtifact.bytecode.object))
    codeAt = await provider0.getCode(workerAddress)
    console.log(codeAt)
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
        const tx = await createX1.deployCreate2(guardedSalt, workerContractArtifact.bytecode.object)
        await tx.wait()
        console.log("worker deployed to ", workerAddress, "on chain 1")
    } else {
        console.log("worker already deployed to ", workerAddress, " on chain 1")
    }


    // call entrypoint
    const interopPoW = new ethers.Contract(interopPoWAddress, interopPoWContractArtifact.abi, wallet0)
    const tx = await interopPoW.run(workerAddress, [0, 1]) // launch everything
    await tx.wait()
    console.log("launched job...")

    // wait for event

    // // Event signature for Transfer (from ERC20 token standard, for example)
    // const transferEventSignature = "Transfer(address,address,uint256)";
    // const transferTopic = ethers.id(transferEventSignature);

    // async function getTransferLogs(fromBlock: number, toBlock: number, fromAddress?: string, toAddress?: string) {
    //     // Set up the filter
    //     const filter: ethers.Filter = {
    //         address: CONTRACT_ADDRESS, // Only logs from this contract address
    //         fromBlock,
    //         toBlock,
    //         topics: [
    //             transferTopic,            // The main topic (Transfer event signature)
    //             fromAddress ? ethers.zeroPadValue(fromAddress, 32) : null, // Topic[1]: 'from' address, if specified
    //             toAddress ? ethers.zeroPadValue(toAddress, 32) : null      // Topic[2]: 'to' address, if specified
    //         ]
    //     };

    //     // Retrieve logs matching the filter
    //     const logs = await provider.getLogs(filter);
    //     return logs.map(log => {
    //         // Parse each log to get event arguments
    //         const parsedLog = ethers.Interface.parseLog(log);
    //         return {
    //             from: parsedLog.args.from,
    //             to: parsedLog.args.to,
    //             value: parsedLog.args.value.toString()
    //         };
    //     });
    // }

    // // Example usage
    // (async () => {
    //     try {
    //         // Retrieve logs for the last 10000 blocks
    //         const logs = await getTransferLogs(14000000, 14001000, "0xFromAddress", "0xToAddress");
    //         console.log("Transfer Logs:", logs);
    //     } catch (error) {
    //         console.error("Error retrieving logs:", error);
    //     }
    // })();


}

main().catch((error) => {
    console.error("Error:", error);
});
