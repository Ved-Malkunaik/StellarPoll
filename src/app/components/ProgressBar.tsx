interface ProgressBarProps {
    percentage: number;
    color?: string; // e.g., "bg-blue-500"
}

export default function ProgressBar({ percentage, color = "bg-blue-600" }: ProgressBarProps) {
    return (
        <div className="relative w-full h-2 bg-slate-700/50 rounded-full overflow-hidden mt-2">
            <div
                className={`absolute top-0 left-0 h-full ${color} transition-all duration-1000 ease-out`}
                style={{ width: `${percentage}%` }}
            >
                <div className="absolute top-0 right-0 bottom-0 w-[20px] bg-gradient-to-r from-transparent to-white/30" />
            </div>
        </div>
    );
}
