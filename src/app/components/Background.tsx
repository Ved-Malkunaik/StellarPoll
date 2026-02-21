export default function Background() {
    return (
        <div className="fixed inset-0 z-[-1] overflow-hidden bg-slate-950">
            <div className="absolute -top-[40%] -left-[20%] w-[70%] h-[70%] rounded-full bg-purple-900/30 blur-[120px] animate-pulse" />
            <div className="absolute top-[20%] -right-[20%] w-[60%] h-[60%] rounded-full bg-blue-900/20 blur-[100px] animate-pulse delay-1000" />
            <div className="absolute -bottom-[30%] left-[20%] w-[50%] h-[50%] rounded-full bg-indigo-900/20 blur-[100px] animate-pulse delay-2000" />
            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        </div>
    );
}
