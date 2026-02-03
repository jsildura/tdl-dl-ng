
"use client";

import { useState, useEffect } from "react";
import { UrlInput } from "@/components/UrlInput";
import { DownloadQueue } from "@/components/DownloadQueue";
import { api } from "@/lib/api";
import { DownloadProgress } from "@/lib/downloader";

interface AuthStatus {
  logged_in: boolean;
  username?: string;
  email?: string;
}

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<AuthStatus>({ logged_in: false });
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);

  useEffect(() => {
    api.checkStatus().then(setStatus).catch(console.error);
  }, []);

  const handleUrlDownload = async (url: string) => {
    setIsLoading(true);
    setError("");
    setDownloadProgress({ stage: 'fetching', progress: 0, message: 'Starting download...' });

    try {
      await api.download(
        { url },
        (progress) => {
          setDownloadProgress(progress);
        }
      );
      console.log("Download completed for URL", url);
    } catch (err) {
      console.error("Download failed", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(`Failed to download: ${message}`);
      setDownloadProgress({ stage: 'error', progress: 0, message });
    } finally {
      setIsLoading(false);
      // Clear progress after a delay on success
      setTimeout(() => {
        if (downloadProgress?.stage === 'complete') {
          setDownloadProgress(null);
        }
      }, 5000);
    }
  };

  const handleLogout = async () => {
    try {
      const result = await api.logout();
      if (result.success) {
        setStatus({ logged_in: false, username: undefined, email: undefined });
      } else {
        setError("Logout failed");
      }
    } catch (err) {
      console.error("Logout failed", err);
      setError("Failed to logout. Check console.");
    }
  };

  return (
    <main className="min-h-screen bg-gray-900 text-gray-100 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="relative text-center space-y-4">
          <div className="absolute top-0 right-0 flex gap-4 items-center">
            {status.logged_in ? (
              <>
                <span className="text-sm font-medium text-cyan-400">
                  Logged in as {status.email || status.username}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-sm font-medium text-red-400 hover:text-red-300 hover:underline transition"
                >
                  Logout
                </button>
              </>
            ) : (
              <a href="/login" className="text-sm font-medium text-cyan-400 hover:text-cyan-300 hover:underline transition">
                Login
              </a>
            )}
            <a href="/settings" className="text-sm font-medium text-gray-400 hover:text-white hover:underline transition">
              Settings
            </a>
          </div>
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
            Tidal DL NG
          </h1>
          <p className="text-gray-400">Next Gen Downloader Web Interface</p>
          {api.isServerless() && (
            <span className="inline-block px-2 py-1 text-xs bg-purple-900/50 text-purple-300 rounded-full">
              Serverless Mode
            </span>
          )}
        </header>

        <UrlInput onDownload={handleUrlDownload} isLoading={isLoading} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Queue</h2>
            <DownloadQueue progress={downloadProgress} />
          </div>

          <div className="space-y-6">
            {error && (
              <div className="p-4 bg-red-900/50 border border-red-700/50 rounded-lg text-red-200">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
