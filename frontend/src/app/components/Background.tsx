
export default function Background() {
    const glows = [
        {
            position: "-left-[20%] -top-[40%]",
            size: "h-[70vw] w-[70vw] max-h-[900px] max-w-[900px]",
            color: "bg-purple-900/30",
            blur: "blur-[120px]",
            animation: "animate-[pulse_8s_ease-in-out_infinite]",
        },
        {
            position: "-right-[20%] top-[20%]",
            size: "h-[60vw] w-[60vw] max-h-[800px] max-w-[800px]",
            color: "bg-blue-900/20",
            blur: "blur-[100px]",
            animation: "animate-[pulse_10s_ease-in-out_infinite]",
        },
        {
            position: "-bottom-[30%] left-[20%]",
            size: "h-[50vw] w-[50vw] max-h-[700px] max-w-[700px]",
            color: "bg-indigo-900/20",
            blur: "blur-[100px]",
            animation: "animate-[pulse_12s_ease-in-out_infinite]",
        },
    ];

    return (
        <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-slate-950"
        >
            {/* Ambient gradient glows */}
            {glows.map((glow, index) => (
                <div
                    key={index}
                    className={`
                        absolute ${glow.position}
                        ${glow.size}
                        rounded-full ${glow.color}
                        ${glow.blur}
                        ${glow.animation}
                        motion-reduce:animate-none
                    `}
                />
            ))}

            {/* Subtle grid texture */}
            <div
                className="
                    absolute inset-0
                    bg-[url('/grid.svg')]
                    bg-repeat
                    opacity-[0.08]
                "
            />

            {/* Contrast overlay */}
            <div className="absolute inset-0 bg-slate-950/5" />
        </div>
    );
}


