const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Keypair, SorobanRpc, Contract, TransactionBuilder, Networks, SorobanDataBuilder, xdr, nativeToScVal } = require('@stellar/stellar-sdk');
const fs = require('fs');

const SERVER_URL = process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = process.env.SOROBAN_NETWORK_PASSPHRASE || Networks.TESTNET;


async function main() {
    const server = new SorobanRpc.Server(SERVER_URL);

    // 1. Generate Deployer Keypair
    const pair = Keypair.random();
    console.log('Generated Deployer Public Key:', pair.publicKey());
    console.log('Secret Key:', pair.secret());

    // 2. Fund Account using Friendbot
    console.log('Funding account...');
    try {
        const response = await fetch(`https://friendbot.stellar.org?addr=${pair.publicKey()}`);
        if (!response.ok) throw new Error('Friendbot failed');
        console.log('Account funded.');
    } catch (e) {
        console.error('Funding failed:', e);
        return;
    }

    // 3. Load WASM
    const wasmPath = path.join(__dirname, '../contracts/poll/target/wasm32-unknown-unknown/release/poll.wasm');
    if (!fs.existsSync(wasmPath)) {
        console.error('WASM file not found at:', wasmPath);
        return;
    }
    const wasm = fs.readFileSync(wasmPath);

    // 4. Upload Contract Code (Install)
    console.log('Uploading/Installing contract code...');
    let source = await server.getAccount(pair.publicKey());

    // Construct install transaction
    // Note: In newer SDKs, `OperationEnum.invokeHostFunction` or similar is used.
    // Or helpers like `installContractCode`.
    // Wait, recent SDK has breaking changes. I should check how to install code.
    // Using `SorobanDataBuilder`? No.
    // Standard way: `Operation.invokeHostFunction({ func: HostFunction.uploadContract(wasm) })`

    // I'll use the current recommended way for `soroban-client` (which is merged into `stellar-sdk`).

    /* 
       For simplicity, I'll rely on `soroban-client` logic but mapped to `stellar-sdk`.
       Upload code returns a WASM hash.
    */

    // Actually, writing raw XDR transaction for installation is verbose.
    // I should check if there's a helper.
    // Since I don't have docs, I'll try to find an example pattern or keep it simple.

    // If I cannot easily install via SDK without docs, maybe I should use `soroban-cli`? But it is missing.
    // Okay, I will try to use `soroban-cli` installation IF `cargo install` works.

    // Let's assume `cargo install soroban-cli` works and use it.
    // The previous attempt to build failed, but now it should pass.
    // If build passes, I'll try installing CLI. It's safer.

    console.log("This script is a placeholder. I will use soroban-cli if possible.");
}

// main();
