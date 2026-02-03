
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

    return (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 shadow-lg">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-cyan-400" />
                    Active Download
                </h3>
                <span className={`text-xs px-2 py-1 rounded-full ${progress ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
                    {progress ? getStatusText() : 'Idle'}
                </span>
            </div>

            {progress ? (
                <div className="space-y-4">
                    <div className="flex justify-between items-center text-sm text-gray-300">
                        <span className="truncate max-w-[80%]">{progress.message}</span>
                        <span>{Math.round(getProgressPercent())}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                        <div
                            className={`${getStatusColor()} h-2 rounded-full transition-all duration-300 ease-in-out`}
                            style={{ width: `${getProgressPercent()}%` }}
                        />
                    </div>
                </div>
            ) : (
                <div className="text-gray-500 text-sm text-center py-4">
                    No active downloads
                </div>
            )}
        </div>
    );
}
