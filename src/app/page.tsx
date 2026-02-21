"use client";

import { useEffect, useState } from "react";
import { checkConnection, connectWallet, getPollState, vote, getVoterChoice, PollState } from "./utils/soroban";
import Background from "./components/Background";
import ConnectWallet from "./components/ConnectWallet";
import PollCard from "./components/PollCard";

export default function Home() {
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [pollState, setPollState] = useState<PollState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [txStatus, setTxStatus] = useState<"IDLE" | "PENDING" | "SUCCESS" | "ERROR">("IDLE");
  const [errorMessage, setErrorMessage] = useState("");
  const [isVoting, setIsVoting] = useState(false);
  const [userChoice, setUserChoice] = useState<number>(-1);

  useEffect(() => {
    // Check wallet connection on load
    checkConnection().then(async (connected) => {
      if (connected) {
        try {
          const addr = await connectWallet();
          if (addr) {
            setWalletAddress(addr);
            // Check which option this address chose
            const choice = await getVoterChoice(addr);
            setUserChoice(choice);
          }
        } catch (e) {
          console.error("Auto-connect failed", e);
        }
      }
    });

    // Start polling for results
    const interval = setInterval(fetchPollState, 5000);
    fetchPollState().then(() => setIsLoading(false)); // Initial fetch

    return () => clearInterval(interval);
  }, []);

  const fetchPollState = async () => {
    try {
      const state = await getPollState();
      if (state) {
        setPollState(state);
      }

      // Also refresh voted status if logged in
      if (walletAddress) {
        const choice = await getVoterChoice(walletAddress);
        setUserChoice(choice);
      }
    } catch (e) {
      console.error("Failed to fetch poll state", e);
    }
  };

  const handleConnect = async () => {
    try {
      const addr = await connectWallet();
      if (addr) {
        setWalletAddress(addr);
        const choice = await getVoterChoice(addr);
        setUserChoice(choice);
      }
    } catch (e) {
      console.error("Connection failed", e);
    }
  };

  const handleVote = async (index: number) => {
    if (!walletAddress || isVoting || txStatus === "PENDING") {
      return;
    }

    setIsVoting(true);
    setTxStatus("PENDING");
    setErrorMessage("");

    try {
      console.log(`Attempting to vote/change for index ${index} with address ${walletAddress}`);
      const result = await vote(index, walletAddress);

      if (result && result.status !== "ERROR") {
        setTxStatus("SUCCESS");

        // Refresh the choice from contract to be sure
        const newChoice = await getVoterChoice(walletAddress);
        setUserChoice(newChoice);

        await fetchPollState(); // Update results immediately

        // Reset success message after 5 seconds
        setTimeout(() => setTxStatus("IDLE"), 5000);
      } else {
        setTxStatus("ERROR");
        setErrorMessage(result?.error || "Transaction failed to submit.");
      }
    } catch (e: any) {
      setTxStatus("ERROR");
      console.warn("Vote error caught in UI:", e.message || e);

      // Parse error more robustly
      const msg = e.message || String(e);
      if (msg.includes("Error(Contract, #1)")) {
        setErrorMessage("Invalid option selected.");
      } else if (msg.includes("Error(Contract, #2)")) {
        setErrorMessage("The poll has not been initialized yet.");
      } else if (msg.includes("Error(Contract, #3)")) {
        setErrorMessage("This poll has already been initialized.");
      } else {
        setErrorMessage(msg.split('\n')[0] || "An unexpected error occurred.");
      }
    } finally {
      setIsVoting(false);
    }
  };

  const totalVotes = pollState?.votes.reduce((a, b) => a + b, 0) || 0;

  return (
    <main className="relative min-h-screen flex flex-col overflow-hidden font-sans text-slate-100">
      <Background />

      <header className="fixed top-0 w-full z-50 transition-all duration-300 bg-slate-900/10 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex-shrink-0 flex items-center">
              <span className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
                Stellar Poll
              </span>
            </div>
            <ConnectWallet address={walletAddress} onConnect={handleConnect} />
          </div>
        </div>
      </header>

      <div className="flex-grow flex items-center justify-center p-4 pt-24 z-10">
        <div className="w-full max-w-4xl animate-fade-in">
          <div className="text-center mb-12">
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-4">
              <span className="block text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">Cast Your Vote</span>
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600">
                On The Blockchain
              </span>
            </h1>
            <p className="mt-4 max-w-2xl mx-auto text-xl text-slate-400">
              Participate in decentralized decision making powered by Soroban smart contracts. Transparent, immutable, and instant.
            </p>
          </div>

          <PollCard
            pollState={pollState}
            totalVotes={totalVotes}
            vote={handleVote}
            txStatus={txStatus}
            isLoading={isLoading}
            isConnected={!!walletAddress}
            userChoice={userChoice}
          />

          {errorMessage && (
            <div className="mt-8 max-w-xl mx-auto p-4 rounded-2xl bg-red-500/10 border border-red-500/50 text-red-400 text-center font-mono text-sm animate-in fade-in slide-in-from-top-2 duration-300">
              <span className="flex items-center justify-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {errorMessage}
              </span>
            </div>
          )}
        </div>
      </div>

      <footer className="w-full py-6 text-center text-slate-500 text-sm z-10 glass border-t-0 border-white/5">
        <p>Built with Next.js, Soroban & Rust on Stellar Testnet</p>
      </footer>
    </main>
  );
}
