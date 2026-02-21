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
    xdr,
    scValToNative,
    nativeToScVal,
    TimeoutInfinite,
    Operation,
    Address,
    Account
} from "@stellar/stellar-sdk";

// Define Contract ID
export const CONTRACT_ID = "CCFYHPXEHMQKWXJLJXZHUL72VB523UKUZBFYFHG6H74F24AETYO6HAA3";
export const NETWORK_PASSPHRASE = Networks.TESTNET;
export const SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org";

const server = new SorobanRpc.Server(SOROBAN_RPC_URL);

export interface PollState {
    question: string;
    options: string[];
    votes: number[];
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

        let simulated = await server.simulateTransaction(tx);

        if (SorobanRpc.Api.isSimulationSuccess(simulated) && simulated.result) {
            const scVal = simulated.result.retval;
            const native = scValToNative(scVal);
            console.log("Poll Raw State:", native);

            // The contract now returns a PollState struct
            // scValToNative parses this as an object { question, options, votes }
            // or sometimes an array if it's older/tuple. Let's handle both.
            let question: string;
            let options: string[];
            let votesMap: any;

            if (Array.isArray(native)) {
                [question, options, votesMap] = native;
            } else {
                question = native.question;
                options = native.options;
                votesMap = native.votes;
            }

            // Convert Map to array of votes
            const votes = options.map((_: any, i: number) => {
                const key = BigInt(i);
                // Robust check for Map-like behavior
                if (votesMap && typeof (votesMap as any).get === 'function') {
                    return Number((votesMap as any).get(key) ?? (votesMap as any).get(i) ?? 0);
                } else if (Array.isArray(votesMap)) {
                    // It might be an array of entries [[key, val], ...]
                    const entry = votesMap.find(([k]: any) => BigInt(k) === key || Number(k) === i);
                    return entry ? Number(entry[1]) : 0;
                } else if (typeof votesMap === 'object' && votesMap !== null) {
                    // It might be a plain object { "0": val, ... }
                    return Number((votesMap as any)[i] ?? (votesMap as any)[i.toString()] ?? 0);
                }
                return 0;
            });

            console.log("Parsed Votes Array:", votes);

            return {
                question,
                options,
                votes
            };
        }
    } catch (e) {
        console.error("Error fetching poll state", e);
    }
    return null;
}

export async function vote(optionIndex: number, userAddress: string): Promise<any> {
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
    } catch (e: any) {
        console.warn("Soroban simulation failed:", e.message || e);

        let errorMessage = "Simulation failed. Please check your connection.";
        // Map new contract error codes
        if (e.message) {
            if (e.message.includes("Error(Contract, #1)")) {
                errorMessage = "Invalid Option Selected";
            } else if (e.message.includes("Error(Contract, #2)")) {
                errorMessage = "Poll Not Initialized";
            } else if (e.message.includes("Error(Contract, #3)")) {
                errorMessage = "Poll Already Initialized";
            }
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
    } else {
        signedXdr = signedTxResponse.signedTxXdr;
    }

    if (!signedXdr) return null;

    try {
        const sendResponse = await server.sendTransaction(TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE));
        if (sendResponse.status === "PENDING") {
            let status: string = sendResponse.status;
            let response: any = sendResponse;
            while (status === "PENDING") {
                await new Promise(resolve => setTimeout(resolve, 2000));
                response = await server.getTransaction(sendResponse.hash);
                status = response.status;
            }
            return response;
        }
        return sendResponse;
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

        let simulated = await server.simulateTransaction(tx);

        if (SorobanRpc.Api.isSimulationSuccess(simulated) && simulated.result) {
            const result = scValToNative(simulated.result.retval);
            // new contract returns Option<u32>, old returned i32
            // Option<u32> is null if None, number if Some
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
