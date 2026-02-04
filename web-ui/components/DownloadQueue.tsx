
"use client";

import { Activity } from "lucide-react";
import { DownloadProgress } from "../lib/downloader";

interface DownloadQueueProps {
    progress?: DownloadProgress | null;
}

export function DownloadQueue({ progress }: DownloadQueueProps) {
    // For serverless mode, progress is passed in as a prop
    // For Python backend mode, we'd use SSE (legacy mode)

    const getProgressPercent = () => {
        if (!progress) return 0;
        return progress.progress;
    };

    const getStatusColor = () => {
        if (!progress) return 'bg-gray-700';
        switch (progress.stage) {
            case 'fetching': return 'bg-blue-500';
            case 'processing': return 'bg-cyan-500';
            case 'complete': return 'bg-green-500';
            case 'error': return 'bg-red-500';
            default: return 'bg-gray-700';
        }
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
        <div className="bg-surface-container rounded-3xl p-6 shadow-md transition-shadow hover:shadow-lg">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-base md:text-xl font-medium text-on-surface flex items-center gap-3">
                    <Activity className="w-6 h-6 text-primary" />
                    Active Download
                </h3>
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${progress ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-on-surface-variant'}`}>
                    {progress ? getStatusText() : 'Idle'}
                </span>
            </div>

            {progress ? (
                <div className="space-y-4">
                    {/* Track info - show for both single and multi-track downloads */}
                    {(isMultiTrack || progress.trackName) && (
                        <div className="flex items-center justify-between text-sm">
                            {isMultiTrack ? (
                                <span className="text-tertiary font-medium">
                                    Track {progress.currentTrack}/{progress.totalTracks}
                                </span>
                            ) : (
                                <span className="text-tertiary font-medium">Track</span>
                            )}
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
        </div>
    );
}
