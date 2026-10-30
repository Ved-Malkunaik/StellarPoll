
import React, { memo, useMemo } from "react";

interface ProgressBarProps {
    percentage: number;
    color?: string;
    height?: string;
    animated?: boolean;
    showGlow?: boolean;
    showShimmer?: boolean;
    className?: string;
}

const ProgressBar = memo(function ProgressBar({
    percentage,
    color = "from-cyan-400 via-blue-500 to-indigo-500",
    height = "h-2",
    animated = true,
    showGlow = true,
    showShimmer = true,
    className = "",
}: ProgressBarProps) {

    const progress = useMemo(
        () => Math.min(100, Math.max(0, Number.isFinite(percentage) ? percentage : 0)),
        [percentage]
    );

    return (
        <div
            className={`relative w-full ${height} mt-2 overflow-hidden rounded-full
            bg-slate-800/80 ring-1 ring-white/[0.06] ${className}`}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progress"
        >
            {/* Progress fill */}
            <div
                className={`
                    relative h-full overflow-hidden rounded-full
                    bg-gradient-to-r ${color}
                    ${animated ? "transition-[width] duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)]" : ""}
                `}
                style={{ width: `${progress}%` }}
            >
                {/* Metallic highlight */}
                <div className="absolute inset-x-0 top-0 h-[45%] bg-white/20 blur-[1px]" />

                {/* Animated shimmer */}
                {showShimmer && progress > 0 && (
                    <div className="absolute inset-0 overflow-hidden">
                        <div className="absolute inset-y-0 -left-1/2 w-1/2
                            bg-gradient-to-r from-transparent via-white/25 to-transparent
                            animate-[shimmer_2.5s_ease-in-out_infinite]" />
                    </div>
                )}

                {/* Leading edge glow */}
                {showGlow && progress > 0 && (
                    <div className="absolute right-0 top-0 h-full w-3
                        bg-white/40 blur-sm" />
                )}
            </div>

            {/* Subtle background track highlight */}
            <div className="pointer-events-none absolute inset-0 rounded-full
                ring-1 ring-inset ring-white/[0.04]" />

            <style>{`
                @keyframes shimmer {
                    0% { transform: translateX(0); opacity: 0; }
                    30% { opacity: 1; }
                    70% { opacity: 1; }
                    100% { transform: translateX(300%); opacity: 0; }
                }

                @media (prefers-reduced-motion: reduce) {
                    .progress-motion {
                        animation: none !important;
                        transition: none !important;
                    }
                }
            `}</style>
        </div>
    );
});

export default ProgressBar;
