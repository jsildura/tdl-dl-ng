
"use client";

import { Activity, RotateCcw } from "lucide-react";
import { DownloadProgress, triggerSaveDialog } from "../lib/downloader";
import { DownloadConsole } from "./DownloadConsole";

interface DownloadQueueProps {
    progress?: DownloadProgress | null;
    logs?: string[];
}

export function DownloadQueue({ progress, logs = [] }: DownloadQueueProps) {
    // For serverless mode, progress is passed in as a prop
    // For Python backend mode, we'd use SSE (legacy mode)

    const getProgressPercent = () => {
        if (!progress) return 0;
        return progress.progress;
    };

    const getStatusText = () => {
        if (!progress) return 'Disconnected';
        switch (progress.stage) {
            case 'fetching': return 'Downloading';
            case 'processing': return 'Processing';
            case 'complete': return 'Complete';
            case 'error': return 'Error';
            default: return 'Idle';
        }
    };

    const isMultiTrack = progress?.totalTracks && progress.totalTracks > 1;

    return (
        <div className="bg-[#e5e5e5] dark:bg-surface-container rounded-3xl p-6 shadow-md transition-shadow hover:shadow-lg">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-base md:text-xl font-medium text-on-surface flex items-center gap-3">
                    Active Download
                </h3>
                <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${progress ? 'bg-primary text-on-primary' : 'bg-[#303030] dark:bg-surface-container-highest text-white dark:text-on-surface-variant'}`}>
                        {progress ? getStatusText() : 'Idle'}
                    </span>
                    {/* Resave button for mobile browsers that fail auto-download */}
                    {progress?.stage === 'complete' && progress.blob && progress.filename && (
                        <button
                            onClick={() => triggerSaveDialog(progress.blob!, progress.filename!)}
                            className="flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full bg-tertiary text-on-tertiary hover:opacity-90 transition-opacity"
                            title="Re-trigger download if file didn't save"
                        >
                            <RotateCcw className="w-3 h-3" />
                            Resave
                        </button>
                    )}
                </div>
            </div>

            {progress ? (
                <div className="space-y-4">
                    {/* Track info - show for both single and multi-track downloads */}
                    {(isMultiTrack || progress.trackName) && (
                        <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                                {isMultiTrack ? (
                                    <span className="text-tertiary font-medium">
                                        Track {progress.currentTrack}/{progress.totalTracks}
                                    </span>
                                ) : (
                                    <span className="text-tertiary font-medium">Track</span>
                                )}
                                {progress.isAtmos && (
                                    <svg
                                        className="h-3 w-auto fill-current text-primary"
                                        viewBox="0 0 269.23 189.28"
                                        aria-label="Dolby Atmos"
                                    >
                                        <title>Dolby Atmos</title>
                                        <path d="M269.23,0V189.28h-27.92c-52.14,0-94.64-42.5-94.64-94.64S189.17,0,241.31,0h27.92Z" />
                                        <path d="M27.92,0c52.14,0,94.64,42.5,94.64,94.64s-42.5,94.64-94.64,94.64H0V0H27.92Z" />
                                    </svg>
                                )}
                            </div>
                            {progress.trackName && (
                                <span className="text-on-surface-variant truncate max-w-[70%] text-right font-medium">
                                    {progress.trackName}
                                </span>
                            )}
                        </div>
                    )}

                    <div className="flex justify-between items-center text-sm text-on-surface-variant font-medium">
                        <span className="truncate max-w-[80%]">{progress.message}</span>
                        <span>{Math.round(getProgressPercent())}%</span>
                    </div>
                    <div className="w-full bg-surface-container-highest rounded-full h-2 overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-300 ease-in-out ${progress.stage === 'error' ? 'bg-error' : 'bg-green-500'}`}
                            style={{ width: `${getProgressPercent()}%` }}
                        />
                    </div>
                </div>
            ) : (
                <div className="text-on-surface-variant/60 text-sm text-center py-6 font-medium">
                    No active downloads
                </div>
            )}

            <DownloadConsole logs={logs} />
        </div>
    );
}
