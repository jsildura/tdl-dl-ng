import React, { useEffect, useRef } from "react";

interface DownloadConsoleProps {
    logs: string[];
}

export function DownloadConsole({ logs }: DownloadConsoleProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    if (logs.length === 0) return null;

    const renderLogLine = (log: string, index: number) => {
        // Check for log level based on content
        let levelColor = "text-gray-300"; // Info/Debug
        let prefixColor = "text-yellow-500"; // Track Name default

        if (log.toLowerCase().includes("success") || log.includes("Complete")) {
            levelColor = "text-green-400";
        } else if (log.toLowerCase().includes("fail") || log.toLowerCase().includes("error")) {
            levelColor = "text-red-400";
        } else if (log.toLowerCase().includes("warn") || log.includes("No lyrics") || log.includes("No genre")) {
            levelColor = "text-orange-300";
        }

        const parts = log.split('|');
        const hasPipe = parts.length > 1;

        if (hasPipe) {
            const prefix = parts[0].trim();
            const rest = parts.slice(1).join('|').trim();
            const messageParts = rest.split('\n');
            const mainMessage = messageParts[0];
            const subMessage = messageParts.slice(1).join('\n');

            return (
                <div key={index} className="flex font-mono text-[11px] leading-relaxed py-1 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors px-2">
                    <div className="flex-1 break-words">
                        <span className={`${prefixColor} font-semibold`}>{prefix}</span>
                        <span className="text-gray-500 mx-2">|</span>
                        <span className={`${levelColor} font-medium`}>{mainMessage}</span>
                        {subMessage && (
                            <div className="text-blue-300/70 text-xs mt-1 italic">
                                {subMessage}
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return (
            <div key={index} className="flex font-mono text-[11px] leading-relaxed py-1 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors px-2">
                <span className={`${levelColor} break-words`}>{log}</span>
            </div>
        );
    };

    return (
        <div
            ref={scrollRef}
            className="bg-[#0c0c0c] rounded-xl h-[160px] overflow-y-auto p-2 custom-scrollbar mt-4"
        >
            {logs.map(renderLogLine)}
            <div className="flex items-center px-2 pt-2 text-gray-600 font-mono text-xs">
                <span className="mr-2 text-green-500">➜</span>
                <span className="animate-pulse">_</span>
            </div>
        </div>
    );
}
