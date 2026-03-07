const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const sdk = require('@stellar/stellar-sdk');
const { Keypair, rpc: SorobanRpc, Contract, TransactionBuilder, Networks, SorobanDataBuilder, xdr, nativeToScVal, Operation, Asset, TimeoutInfinite, scValToNative, Address } = sdk;
const fs = require('fs');
const crypto = require('crypto');

console.log('SDK Imports:', {
    Address: !!Address,
    xdr: !!xdr,
    Networks: !!Networks,
    Operation: !!Operation
});

const SERVER_URL = process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = process.env.SOROBAN_NETWORK_PASSPHRASE || Networks.TESTNET;


async function main() {
    try {
        const server = new SorobanRpc.Server(SERVER_URL);

        // 1. Generate Deployer Keypair
        const pair = Keypair.random();
        console.log('Deployer Public Key:', pair.publicKey());
        console.log('Secret Key:', pair.secret());

        // 2. Fund Account using Friendbot
        console.log('Funding account...');
        try {
            const response = await fetch(`https://friendbot.stellar.org?addr=${pair.publicKey()}`);
            if (!response.ok) throw new Error('Friendbot failed');
            console.log('Account funded.');
        } catch (e) {
            console.error('Funding failed:', e);
        }

        // 3. Load WASM
        const wasmPath = path.join(__dirname, '../contracts/poll/target/wasm32-unknown-unknown/release/poll.wasm');
        if (!fs.existsSync(wasmPath)) {
            console.error('WASM file not found at:', wasmPath);
            process.exit(1);
        }
        const wasm = fs.readFileSync(wasmPath);

        let account = await server.getAccount(pair.publicKey());

        // 4. Upload Contract Code
        console.log('Uploading contract code...');
        const uploadOp = Operation.invokeHostFunction({
            func: xdr.HostFunction.hostFunctionTypeUploadContractWasm(wasm),
            auth: []
        });

        let wasmHash = await submitTx(server, pair, account, uploadOp);
        if (!wasmHash) {
            console.error("Failed to upload WASM");
            process.exit(1);
        }
        console.log("WASM Hash:", wasmHash.toString('hex'));

        // 5. Instantiate Contract
        console.log('Instantiating contract...');
        const salt = crypto.randomBytes(32);
        const createOp = Operation.invokeHostFunction({
            func: xdr.HostFunction.hostFunctionTypeCreateContract(
                new xdr.CreateContractArgs({
                    contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(
                        new xdr.ContractIdPreimageFromAddress({
                            address: Address.fromString(pair.publicKey()).toScAddress(),
                            salt: salt
                        })
                    ),
                    executable: xdr.ContractExecutable.contractExecutableWasm(wasmHash)
                })
            ),
            auth: []
        });

        // We must refresh account seq
        account = await server.getAccount(pair.publicKey());
        let contractIdScVal = await submitTx(server, pair, account, createOp);
        if (!contractIdScVal) {
            console.error("Failed to instantiate contract");
            process.exit(1);
        }

        // contractIdScVal is Address ScVal
        // We need to convert ScVal to Address string.
        // Address.fromScVal returns Address object.
        const contractIdAddress = Address.fromScVal(contractIdScVal).toString();
        console.log("Contract ID:", contractIdAddress);


        // 6. Initialize Contract
        console.log('Initializing contract...');
        const question = "What is your favorite Soroban feature?";
        const options = ["Smart Contracts", "Events", "Interoperability"];

        const invokeOp = Operation.invokeHostFunction({
            func: xdr.HostFunction.hostFunctionTypeInvokeContract(
                new xdr.InvokeContractArgs({
                    contractAddress: Address.fromString(contractIdAddress).toScAddress(),
                    functionName: "init",
                    args: [
                        nativeToScVal(question),
                        nativeToScVal(options)
                    ]
                })
            ),
            auth: []
        });

        account = await server.getAccount(pair.publicKey());
        await submitTx(server, pair, account, invokeOp);
        console.log("Contract Initialized!");

        // Save Contract ID
        fs.writeFileSync(path.join(__dirname, '../contract_id.txt'), contractIdAddress);
        fs.writeFileSync(path.join(__dirname, '../deployer_secret.txt'), pair.secret());

    } catch (err) {
        console.log("Main Error Stack:", err.stack);
        console.log("Main Error Message:", err.message);
        if (err.response) {
            console.log("Error Response:", JSON.stringify(err.response, null, 2));
        }
        process.exit(1);
    }
}

async function submitTx(server, pair, account, operation) {
    const tx = new TransactionBuilder(account, {
        fee: "100000",
        networkPassphrase: NETWORK_PASSPHRASE,
    })
        .addOperation(operation)
        .setTimeout(30)
        .build();

    // Prepare (Simulate + Restore Footprint)
    const preparedTx = await server.prepareTransaction(tx);

    preparedTx.sign(pair);

    const sendResp = await server.sendTransaction(preparedTx);
    if (sendResp.status !== "PENDING") {
        console.error("Send failed:", sendResp);
        return null;
    }

    let result = await waitForTransaction(server, sendResp.hash);
    if (result.status !== SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
        console.error("Transaction failed:", result);
        // If failed, try to get error info
        if (result.resultMetaXdr) {
            // Debugging help
        }
        return null;
    }

    if (result.returnValue) {
        return result.returnValue;
    }
    return null;
}

async function waitForTransaction(server, hash) {
    let attempts = 0;
    while (attempts < 60) { // Increased timeout
        try {
            const tx = await server.getTransaction(hash);
            if (tx && (tx.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS || tx.status === SorobanRpc.Api.GetTransactionStatus.FAILED)) {
                return tx;
            }
        } catch (e) {
            console.log("Waiting for tx...", e.message);
        }
        await new Promise(r => setTimeout(r, 1000));
        attempts++;
    }
    return { status: "TIMEOUT" };
}

function hash(data) {
    return crypto.createHash('sha256').update(data).digest();
}

main();
