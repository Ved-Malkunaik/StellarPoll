import { Contract, Networks, TransactionBuilder, Account, rpc as SorobanRpc, Address, nativeToScVal } from "@stellar/stellar-sdk";

const CONTRACT_ID = "CCFYHPXEHMQKWXJLJXZHUL72VB523UKUZBFYFHG6H74F24AETYO6HAA3";
const NETWORK_PASSPHRASE = Networks.TESTNET;
const SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org";
const server = new SorobanRpc.Server(SOROBAN_RPC_URL);

async function estimateFee() {
    const contract = new Contract(CONTRACT_ID!);
    const dummyAccount = new Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "0");
    const tx = new TransactionBuilder(
        dummyAccount,
        {
            fee: "10000",
            networkPassphrase: NETWORK_PASSPHRASE,
        }
    ).addOperation(contract.call("vote", new Address("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF").toScVal(), nativeToScVal(0, { type: 'u32' }))).setTimeout(30).build();

    try {
        const simulated = await server.simulateTransaction(tx);
        console.log("simulated:", simulated);
        const prepared = await server.prepareTransaction(tx);
        console.log("prepared fee:", prepared.fee);
    } catch (e: any) {
        console.error("error:", e.message || e);
    }
}

estimateFee();
