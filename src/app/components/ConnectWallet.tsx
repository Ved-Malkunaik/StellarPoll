interface ConnectWalletProps {
    address: string;
    onConnect: () => void;
}

export default function ConnectWallet({ address, onConnect }: ConnectWalletProps) {
    return (
        <div className="flex justify-end p-4 z-50 relative">
            {!address ? (
                <button
                    onClick={onConnect}
                    className="group relative px-6 py-2 font-bold text-white transition-all duration-300 transform bg-slate-900 rounded-full hover:bg-slate-800 hover:scale-105 hover:shadow-lg hover:shadow-cyan-500/50 border border-slate-700"
                >
                    <span className="relative z-10 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent group-hover:text-white transition-colors duration-300">
                        Connect Wallet
                    </span>
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-500/20 to-blue-600/20 blur opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </button>
            ) : (
                <div className="flex items-center space-x-2 px-4 py-2 bg-slate-800/50 backdrop-blur-md rounded-full border border-slate-700 shadow-lg">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="font-mono text-sm text-slate-300">
                        {address.substring(0, 4)}...{address.substring(address.length - 4)}
                    </span>
                </div>
            )}
        </div>
    );
}
