import {
    isConnected,
    requestAccess,
    signTransaction,
    setAllowed,
} from "@stellar/freighter-api";
import {
    Contract,
    Networks,
    TransactionBuilder,
    rpc as SorobanRpc,
    scValToNative,
    nativeToScVal,
    Address,
    Account
} from "@stellar/stellar-sdk";

// Define Contract ID
export const CONTRACT_ID = process.env.NEXT_PUBLIC_SOROBAN_CONTRACT_ID || "CCFYHPXEHMQKWXJLJXZHUL72VB523UKUZBFYFHG6H74F24AETYO6HAA3";
export const NETWORK_PASSPHRASE = process.env.NEXT_PUBLIC_SOROBAN_NETWORK_PASSPHRASE || Networks.TESTNET;
export const SOROBAN_RPC_URL = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org";


const server = new SorobanRpc.Server(SOROBAN_RPC_URL);

export interface PollState {
    question: string;
    options: string[];
    votes: number[];
    admin: string;
    token: string;
    fee: bigint;
}

export async function checkConnection(): Promise<boolean> {
    const connected = await isConnected();
    if (connected) {
        return true;
    }
    return false;
}

export async function connectWallet(): Promise<string> {
    const { address } = await requestAccess();
    if (await setAllowed()) {
        return address;
    }
    return "";
}

export async function getPollState(): Promise<PollState | null> {
    const contract = new Contract(CONTRACT_ID!);

    try {
        const dummyAccount = new Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "0");

        const tx = new TransactionBuilder(
            dummyAccount,
            {
                fee: "100",
                networkPassphrase: NETWORK_PASSPHRASE,
            }
        ).addOperation(contract.call("get_poll_state")).setTimeout(30).build();

        const simulated = await server.simulateTransaction(tx);

        if (SorobanRpc.Api.isSimulationSuccess(simulated) && simulated.result) {
            const scVal = simulated.result.retval;
            const native = scValToNative(scVal);
            console.log("Poll Raw State:", native);

            let question: string;
            let options: string[];
            let votesMap: unknown;
            let admin: string;
            let token: string;
            let fee: bigint;

            if (Array.isArray(native)) {
                [question, options, votesMap, admin, token, fee] = native;
            } else {
                question = native.question;
                options = native.options;
                votesMap = native.votes;
                admin = native.admin;
                token = native.token;
                fee = BigInt(native.fee || 0);
            }

            // Convert Map to array of votes
            const votes = options.map((_: unknown, i: number) => {
                const key = BigInt(i);
                if (votesMap instanceof Map) {
                    const map = votesMap as Map<unknown, unknown>;
                    return Number(map.get(key) ?? map.get(i) ?? 0);
                } else if (Array.isArray(votesMap)) {
                    const entry = (votesMap as unknown[][]).find(([k]: unknown[]) => BigInt(k as string | number | bigint) === key || Number(k) === i);
                    return entry ? Number(entry[1]) : 0;
                } else if (typeof votesMap === 'object' && votesMap !== null) {
                    const obj = votesMap as Record<string, unknown>;
                    return Number(obj[i] ?? obj[i.toString()] ?? 0);
                }
                return 0;
            });

            return {
                question,
                options,
                votes,
                admin,
                token,
                fee
            };
        }
    } catch (e) {
        console.error("Error fetching poll state", e);
    }
    return null;
}

export interface VoteResult {
    status: string;
    error?: string;
    hash?: string;
}

export async function vote(optionIndex: number, userAddress: string): Promise<VoteResult | null> {
    const contract = new Contract(CONTRACT_ID!);

    console.log("Fetching account info for:", userAddress);
    const account = await server.getAccount(userAddress);

    const tx = new TransactionBuilder(
        account,
        {
            fee: "100000",
            networkPassphrase: NETWORK_PASSPHRASE,
        }
    )
        .addOperation(contract.call("vote", new Address(userAddress).toScVal(), nativeToScVal(optionIndex, { type: 'u32' })))
        .setTimeout(30)
        .build();

    console.log("Preparing transaction for option", optionIndex, "...");
    let preparedTx;
    try {
        preparedTx = await server.prepareTransaction(tx);
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn("Soroban simulation failed:", msg);

        let errorMessage = "Simulation failed. Please check your connection.";
        // Map new contract error codes
        if (msg.includes("Error(Contract, #1)")) {
            errorMessage = "Invalid Option Selected";
        } else if (msg.includes("Error(Contract, #2)")) {
            errorMessage = "Poll Not Initialized";
        } else if (msg.includes("Error(Contract, #3)")) {
            errorMessage = "Poll Already Initialized";
        }

        return { status: "ERROR", error: errorMessage };
    }

    // Sign with Freighter
    const signedTxResponse = await signTransaction(preparedTx.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE });

    if (!signedTxResponse) {
        console.log("Transaction cancelled by user");
        return null;
    }

    let signedXdr: string | undefined;
    if (typeof signedTxResponse === 'string') {
        signedXdr = signedTxResponse;
    } else if (signedTxResponse && typeof signedTxResponse === 'object' && 'signedTxXdr' in signedTxResponse) {
        signedXdr = (signedTxResponse as { signedTxXdr: string }).signedTxXdr;
    }

    if (!signedXdr) return null;

    try {
        const sendResponse = await server.sendTransaction(TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE));
        if (sendResponse.status === "PENDING") {
            let status: string = sendResponse.status;
            let response: SorobanRpc.Api.GetTransactionResponse = sendResponse as unknown as SorobanRpc.Api.GetTransactionResponse;
            while (status === "PENDING") {
                await new Promise(resolve => setTimeout(resolve, 2000));
                response = await server.getTransaction(sendResponse.hash);
                status = response.status;
            }
            return response as unknown as VoteResult;
        }
        return sendResponse as unknown as VoteResult;
    } catch (e) {
        console.error("Error sending transaction:", e);
        return null;
    }
}

export async function hasVoted(userAddress: string): Promise<boolean> {
    const choice = await getVoterChoice(userAddress);
    return choice !== -1;
}

export async function getVoterChoice(userAddress: string): Promise<number> {
    const contract = new Contract(CONTRACT_ID!);
    try {
        const dummyAccount = new Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "0");
        const tx = new TransactionBuilder(
            dummyAccount,
            {
                fee: "100",
                networkPassphrase: NETWORK_PASSPHRASE,
            }
        ).addOperation(contract.call("get_voter_choice", new Address(userAddress).toScVal())).setTimeout(30).build();

        const simulated = await server.simulateTransaction(tx);

        if (SorobanRpc.Api.isSimulationSuccess(simulated) && simulated.result) {
            const result = scValToNative(simulated.result.retval);
            if (result === null || result === undefined) {
                return -1;
            }
            return Number(result);
        }
    } catch (e) {
        console.warn("Error getting voter choice", e);
    }
    return -1;
}

export async function getTokenBalance(userAddress: string, tokenAddress: string): Promise<bigint> {
    if (!tokenAddress || !userAddress) return BigInt(0);
    const contract = new Contract(tokenAddress);
    try {
        const dummyAccount = new Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "0");
        const tx = new TransactionBuilder(
            dummyAccount,
            {
                fee: "100",
                networkPassphrase: NETWORK_PASSPHRASE,
            }
        ).addOperation(contract.call("balance", new Address(userAddress).toScVal())).setTimeout(30).build();

        const simulated = await server.simulateTransaction(tx);

        if (SorobanRpc.Api.isSimulationSuccess(simulated) && simulated.result) {
            return BigInt(scValToNative(simulated.result.retval));
        }
    } catch (e) {
        console.error("Error fetching token balance", e);
    }
    return BigInt(0);
}
