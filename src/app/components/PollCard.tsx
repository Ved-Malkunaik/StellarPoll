import { PollState } from "../utils/soroban";
import ProgressBar from "./ProgressBar";

interface PollCardProps {
    pollState: PollState | null;
    totalVotes: number;
    vote: (index: number) => void;
    txStatus: "IDLE" | "PENDING" | "SUCCESS" | "ERROR";
    isLoading?: boolean;
    isConnected?: boolean;
    userChoice?: number;
}

export default function PollCard({
    pollState,
    totalVotes,
    vote,
    txStatus,
    isLoading = false,
    isConnected = false,
    userChoice = -1,
}: PollCardProps) {
    if (!pollState || isLoading) {
        return (
            <div className="w-full max-w-xl mx-auto p-8 rounded-3xl bg-slate-900/40 backdrop-blur-xl border border-white/10 shadow-2xl animate-pulse">
                <div className="h-8 bg-slate-700/50 rounded-lg w-3/4 mx-auto mb-8" />
                <div className="space-y-4">
                    <div className="h-16 bg-slate-800/50 rounded-xl" />
                    <div className="h-16 bg-slate-800/50 rounded-xl" />
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-xl mx-auto p-8 rounded-3xl bg-slate-900/40 backdrop-blur-xl border border-white/10 shadow-2xl relative overflow-hidden transition-all duration-500">
            {/* Glow effect */}
            <div className="absolute top-0 w-full h-px bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50" />

            {!isConnected && (
                <div className="absolute inset-0 z-20 bg-slate-900/40 backdrop-blur-[4px] flex items-center justify-center p-6 text-center group cursor-default">
                    <div className="bg-slate-950/80 border border-white/10 p-6 rounded-2xl shadow-2xl transform transition-transform group-hover:scale-105">
                        <p className="text-cyan-400 font-bold mb-2">Connect to Participate</p>
                        <p className="text-slate-300 text-sm">Sign in with your wallet to see results and cast your vote.</p>
                    </div>
                </div>
            )}

            <h2 className="text-3xl font-bold mb-8 text-center bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                {pollState.question}
            </h2>

            <div className={`space-y-4 transition-all duration-500 ${!isConnected ? 'opacity-40 grayscale-[0.8] pointer-events-none' : ''}`}>
                {pollState.options.map((option, idx) => {
                    const voteCount = pollState.votes[idx] || 0;
                    const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;
                    const isPending = txStatus === "PENDING";
                    const isSelected = userChoice === idx;

                    return (
                        <button
                            key={idx}
                            onClick={() => vote(idx)}
                            disabled={isPending || !isConnected}
                            className={`w-full group relative overflow-hidden rounded-xl border transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed ${isSelected
                                ? 'border-cyan-500/80 bg-cyan-500/15 shadow-[0_0_20px_rgba(6,182,212,0.15)]'
                                : 'border-white/5 bg-slate-800/40 hover:border-cyan-500/40 hover:bg-slate-700/50'
                                }`}
                        >
                            <div className="relative p-4 z-10 text-left">
                                <div className="flex justify-between items-center mb-1">
                                    <div className="flex items-center space-x-3">
                                        <span className={`font-semibold text-lg transition-colors ${isSelected ? 'text-white' : 'text-slate-100 group-hover:text-white'
                                            }`}>
                                            {option}
                                        </span>
                                        {isConnected && isSelected && (
                                            <span className="flex items-center px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-bold uppercase tracking-wider border border-cyan-500/30 animate-in fade-in zoom-in duration-300">
                                                My Choice
                                            </span>
                                        )}
                                    </div>
                                    {isConnected && (
                                        <span className={`font-mono text-sm ${isSelected ? 'text-cyan-400' : 'text-slate-400'}`}>
                                            {percentage.toFixed(1)}%
                                        </span>
                                    )}
                                </div>

                                {isConnected ? (
                                    <>
                                        <ProgressBar
                                            percentage={percentage}
                                            color={isSelected ? "bg-gradient-to-r from-cyan-400 to-blue-500" : "bg-gradient-to-r from-slate-500 to-slate-600"}
                                        />
                                        <div className="flex justify-between items-center mt-1">
                                            <span className="text-[10px] text-slate-500 font-medium italic">
                                                {isSelected ? "Click again to undo" : "Click to select"}
                                            </span>
                                            <span className="text-xs text-slate-400 font-mono">
                                                {voteCount} votes
                                            </span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="h-2 bg-slate-700/30 rounded-full mt-2" />
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>

            {isConnected && txStatus !== "IDLE" && (
                <div className="mt-6 text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {txStatus === "PENDING" && (
                        <span className="inline-flex items-center text-yellow-400 text-sm font-mono">
                            <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-yellow-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Syncing Selection With Blockchain...
                        </span>
                    )}
                    {txStatus === "SUCCESS" && (
                        <span className="text-green-400 text-sm font-mono font-bold drop-shadow-[0_0_10px_rgba(74,222,128,0.5)]">
                            ✨ Selection Confirmed Successfully
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
