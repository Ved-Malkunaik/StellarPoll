const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const sdk = require('@stellar/stellar-sdk');
const { Keypair, rpc: SorobanRpc, Contract, TransactionBuilder, Networks, xdr, nativeToScVal, Operation, Address, scValToNative } = sdk;
const fs = require('fs');
const crypto = require('crypto');

const SERVER_URL = process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = process.env.SOROBAN_NETWORK_PASSPHRASE || Networks.TESTNET;

async function deployContract(server, pair, wasmPath) {
    const wasm = fs.readFileSync(wasmPath);
    let account = await server.getAccount(pair.publicKey());

    // 1. Upload
    console.log(`Uploading ${path.basename(wasmPath)}...`);
    const uploadOp = Operation.invokeHostFunction({
        func: xdr.HostFunction.hostFunctionTypeUploadContractWasm(wasm),
        auth: []
    });

    const txUpload = new TransactionBuilder(account, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE })
        .addOperation(uploadOp).setTimeout(30).build();
    const prepUpload = await server.prepareTransaction(txUpload);
    prepUpload.sign(pair);
    const sendUpload = await server.sendTransaction(prepUpload);

    let wasmHashScVal;
    let attempts = 0;
    while (attempts < 30) {
        const tx = await server.getTransaction(sendUpload.hash);
        if (tx.status === 'SUCCESS') {
            wasmHashScVal = tx.returnValue;
            break;
        }
        await new Promise(r => setTimeout(r, 1000));
        attempts++;
    }
    if (!wasmHashScVal) throw new Error("WASM upload failed");

    // 2. Instantiate
    console.log(`Instantiating...`);
    account = await server.getAccount(pair.publicKey());
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
                executable: xdr.ContractExecutable.contractExecutableWasm(wasmHashScVal.bytes())
            })
        ),
        auth: []
    });

    const txCreate = new TransactionBuilder(account, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE })
        .addOperation(createOp).setTimeout(30).build();
    const prepCreate = await server.prepareTransaction(txCreate);
    prepCreate.sign(pair);
    const sendCreate = await server.sendTransaction(prepCreate);

    let contractIdScVal;
    attempts = 0;
    while (attempts < 30) {
        const tx = await server.getTransaction(sendCreate.hash);
        if (tx.status === 'SUCCESS') {
            contractIdScVal = tx.returnValue;
            break;
        }
        await new Promise(r => setTimeout(r, 1000));
        attempts++;
    }

    return Address.fromScVal(contractIdScVal).toString();
}

async function main() {
    const server = new SorobanRpc.Server(SERVER_URL);
    const pair = Keypair.random();
    console.log('Deployer Public Key:', pair.publicKey());

    console.log('Funding account...');
    await fetch(`https://friendbot.stellar.org?addr=${pair.publicKey()}`);

    // 1. Deploy POLL Token
    const tokenWasmPath = path.join(__dirname, '../target/wasm32-unknown-unknown/release/poll_token.optimized.wasm');
    const tokenId = await deployContract(server, pair, tokenWasmPath);
    console.log("POLL_TOKEN_ID:", tokenId);

    // 2. Initialize POLL Token
    console.log('Initializing Token...');
    let account = await server.getAccount(pair.publicKey());
    const initTokenOp = Operation.invokeHostFunction({
        func: xdr.HostFunction.hostFunctionTypeInvokeContract(
            new xdr.InvokeContractArgs({
                contractAddress: Address.fromString(tokenId).toScAddress(),
                functionName: "initialize",
                args: [
                    Address.fromString(pair.publicKey()).toScVal(), // Admin
                    nativeToScVal(18, { type: 'u32' }), // Decimals
                    nativeToScVal("PollToken"),
                    nativeToScVal("POLL")
                ]
            })
        ),
        auth: []
    });
    const txInitToken = new TransactionBuilder(account, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE })
        .addOperation(initTokenOp).setTimeout(30).build();
    const prepInitToken = await server.prepareTransaction(txInitToken);
    prepInitToken.sign(pair);
    await server.sendTransaction(prepInitToken);

    // 2.5 Mint tokens to the deployer
    console.log('Minting POLL Tokens to Admin...');
    account = await server.getAccount(pair.publicKey());
    const mintAmount = BigInt(1000000 * 10 ** 18); // Mint 1,000,000 POLL tokens
    const mintTokenOp = Operation.invokeHostFunction({
        func: xdr.HostFunction.hostFunctionTypeInvokeContract(
            new xdr.InvokeContractArgs({
                contractAddress: Address.fromString(tokenId).toScAddress(),
                functionName: "mint",
                args: [
                    Address.fromString(pair.publicKey()).toScVal(), // to
                    nativeToScVal(mintAmount, { type: 'i128' }) // amount
                ]
            })
        ),
        auth: []
    });
    const txMintToken = new TransactionBuilder(account, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE })
        .addOperation(mintTokenOp).setTimeout(30).build();
    const prepMintToken = await server.prepareTransaction(txMintToken);
    prepMintToken.sign(pair);
    await server.sendTransaction(prepMintToken);

    // 3. Deploy Poll Contract
    const pollWasmPath = path.join(__dirname, '../target/wasm32-unknown-unknown/release/poll.optimized.wasm');
    const pollId = await deployContract(server, pair, pollWasmPath);
    console.log("POLL_CONTRACT_ID:", pollId);

    // 4. Initialize Poll Contract
    console.log('Initializing Poll...');
    account = await server.getAccount(pair.publicKey());
    const fee = BigInt(10 * 10 ** 18); // 10 POLL tokens (assuming 18 decimals)
    const initPollOp = Operation.invokeHostFunction({
        func: xdr.HostFunction.hostFunctionTypeInvokeContract(
            new xdr.InvokeContractArgs({
                contractAddress: Address.fromString(pollId).toScAddress(),
                functionName: "init",
                args: [
                    Address.fromString(pair.publicKey()).toScVal(), // Admin
                    Address.fromString(tokenId).toScVal(), // POLL Token
                    nativeToScVal(fee, { type: 'i128' }), // Fee
                    nativeToScVal("What should we build next?"),
                    nativeToScVal(["Liquidity Pools", "NFT Voting", "DAO Framework"])
                ]
            })
        ),
        auth: []
    });
    const txInitPoll = new TransactionBuilder(account, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE })
        .addOperation(initPollOp).setTimeout(30).build();
    const prepInitPoll = await server.prepareTransaction(txInitPoll);
    prepInitPoll.sign(pair);
    await server.sendTransaction(prepInitPoll);

    console.log("\n--- DEPLOYMENT SUMMARY ---");
    console.log("POLL TOKEN ID:", tokenId);
    console.log("POLL CONTRACT ID:", pollId);
    console.log("ADMIN:", pair.publicKey());
    console.log("--------------------------\n");

    fs.writeFileSync('deployed_ids.json', JSON.stringify({ tokenId, pollId, admin: pair.publicKey() }, null, 2));
}

main().catch(console.error);
