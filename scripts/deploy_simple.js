const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const sdk = require('@stellar/stellar-sdk');
const { Keypair, rpc: SorobanRpc, Contract, TransactionBuilder, Networks, xdr, nativeToScVal, Operation, Address, scValToNative } = sdk;
const fs = require('fs');
const crypto = require('crypto');

const SERVER_URL = process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = process.env.SOROBAN_NETWORK_PASSPHRASE || Networks.TESTNET;


async function main() {
    const server = new SorobanRpc.Server(SERVER_URL);
    const pair = Keypair.random();
    console.log('Deployer Public Key:', pair.publicKey());

    console.log('Funding account...');
    await fetch(`https://friendbot.stellar.org?addr=${pair.publicKey()}`);

    const wasmPath = path.join(__dirname, '../target/wasm32-unknown-unknown/release/poll.wasm');
    const wasm = fs.readFileSync(wasmPath);

    let account = await server.getAccount(pair.publicKey());

    // 1. Upload
    console.log('Uploading WASM...');
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
    console.log("WASM Hash (ScVal type):", wasmHashScVal._arm);

    // 2. Instantiate
    console.log('Instantiating...');
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

    const contractId = Address.fromScVal(contractIdScVal).toString();
    console.log("CONTRACT_ID:", contractId);
    fs.writeFileSync('contract_id.txt', contractId);

    // 3. Init
    console.log('Initializing...');
    account = await server.getAccount(pair.publicKey());
    const fee = BigInt(1 * 10 ** 7); // 1 XLM in stroops (7 decimals)
    const initOp = Operation.invokeHostFunction({
        func: xdr.HostFunction.hostFunctionTypeInvokeContract(
            new xdr.InvokeContractArgs({
                contractAddress: Address.fromString(contractId).toScAddress(),
                functionName: "init",
                args: [
                    Address.fromString(pair.publicKey()).toScVal(), // Admin
                    Address.fromString("CCW67TSZV3SA22PTEA3TRUMIMAMA6AEMR2KOTX62PEBMG4FBE2UKQJQA").toScVal(), // Fallback Token
                    nativeToScVal(fee, { type: 'i128' }), // Fee
                    nativeToScVal("What is your favorite Soroban feature?"),
                    nativeToScVal(["Smart Contracts", "Events", "Interoperability"])
                ]
            })
        ),
        auth: []
    });

    const txInit = new TransactionBuilder(account, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE })
        .addOperation(initOp).setTimeout(30).build();
    const prepInit = await server.prepareTransaction(txInit);
    prepInit.sign(pair);
    await server.sendTransaction(prepInit);

    console.log("DONE! Update your frontend with:", contractId);
}

main().catch(console.error);
