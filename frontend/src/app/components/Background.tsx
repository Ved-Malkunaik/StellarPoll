
export default function Background() {
    return (
        <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-slate-950"
        >
            {/* Purple glow — top left */}
            <div
                className="
                    absolute -left-[20%] -top-[40%]
                    h-[70vw] w-[70vw] max-h-[900px] max-w-[900px]
                    rounded-full bg-purple-900/30
                    blur-[120px]
                    animate-[pulse_8s_ease-in-out_infinite]
                    motion-reduce:animate-none
                "
            />

            {/* Blue glow — top right */}
            <div
                className="
                    absolute -right-[20%] top-[20%]
                    h-[60vw] w-[60vw] max-h-[800px] max-w-[800px]
                    rounded-full bg-blue-900/20
                    blur-[100px]
                    animate-[pulse_10s_ease-in-out_infinite]
                    motion-reduce:animate-none
                "
            />

            {/* Indigo glow — bottom */}
            <div
                className="
                    absolute -bottom-[30%] left-[20%]
                    h-[50vw] w-[50vw] max-h-[700px] max-w-[700px]
                    rounded-full bg-indigo-900/20
                    blur-[100px]
                    animate-[pulse_12s_ease-in-out_infinite]
                    motion-reduce:animate-none
                "
            />

            {/* Subtle grid overlay */}
            <div
                className="
                    absolute inset-0
                    bg-[url('/grid.svg')]
                    bg-repeat
                    opacity-[0.08]
                "
            />

            {/* Soft dark overlay for consistent contrast */}
            <div className="absolute inset-0 bg-slate-950/5" />
        </div>
    );
}

