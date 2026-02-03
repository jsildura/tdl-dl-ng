
"use client";

import { useState, useEffect } from "react";
import { UrlInput } from "../components/UrlInput";
import { DownloadQueue } from "../components/DownloadQueue";
import { api } from "../lib/api";
import { DownloadProgress } from "../lib/downloader";
import { Menu, X } from "lucide-react";

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
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
    <main className="min-h-screen bg-background text-on-background p-4 md:p-8 font-roboto selection:bg-primary-container selection:text-on-primary-container">
      <div className="max-w-5xl mx-auto space-y-12">
        <header className="relative text-center space-y-6 pt-4 md:pt-12">

          {/* Desktop Menu */}
          <div className="hidden md:flex absolute top-0 right-0 gap-2 items-center">
            {status.logged_in ? (
              <>
                <span className="text-sm font-medium text-primary px-3 py-1 bg-primary-container/30 rounded-full border border-primary/20">
                  {status.email || status.username}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-sm font-medium text-error hover:bg-error-container/20 px-3 py-1.5 rounded-full transition-colors duration-200"
                >
                  Logout
                </button>
              </>
            ) : (
              <a href="/login" className="text-sm font-medium text-primary hover:bg-primary-container/20 px-4 py-2 rounded-full transition-colors duration-200">
                Login
              </a>
            )}
            <a href="/settings" className="text-sm font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest px-4 py-2 rounded-full transition-colors duration-200">
              Settings
            </a>
          </div>

          {/* Mobile Hamburger Menu */}
          <div className="md:hidden absolute top-0 right-0 z-50">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 text-on-surface hover:bg-surface-container-highest rounded-full transition-colors"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-surface-container rounded-2xl shadow-xl border border-outline-variant/20 p-2 flex flex-col gap-1 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {status.logged_in ? (
                  <>
                    <div className="px-4 py-3 border-b border-outline-variant/20 mb-1">
                      <p className="text-xs text-on-surface-variant">Signed in as</p>
                      <p className="text-sm font-medium text-primary truncate">
                        {status.email || status.username}
                      </p>
                    </div>
                    <a href="/settings" className="flex items-center w-full px-4 py-2 text-sm text-on-surface hover:bg-surface-container-highest rounded-xl transition-colors">
                      Settings
                    </a>
                    <button
                      onClick={() => {
                        handleLogout();
                        setIsMenuOpen(false);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-error hover:bg-error-container/20 rounded-xl transition-colors text-left"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    <a href="/login" className="block px-4 py-2 text-sm font-medium text-primary hover:bg-primary-container/20 rounded-xl transition-colors">
                      Login
                    </a>
                    <a href="/settings" className="block px-4 py-2 text-sm text-on-surface hover:bg-surface-container-highest rounded-xl transition-colors">
                      Settings
                    </a>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4 pt-8">
            <h1 className="text-5xl md:text-6xl font-normal tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary pb-2">
              Tidal DL NG
            </h1>
            <p className="text-lg md:text-xl text-on-surface-variant max-w-lg mx-auto leading-relaxed">
              Next Gen Downloader Web Interface
            </p>
            {api.isServerless() && (
              <span className="inline-flex items-center px-3 py-1 text-sm font-medium bg-secondary-container text-on-secondary-container rounded-lg shadow-sm">
                Serverless Mode
              </span>
            )}
          </div>
        </header>

        <div className="space-y-12">
          <UrlInput onDownload={handleUrlDownload} isLoading={isLoading} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            <div className="space-y-6">
              <h2 className="text-2xl font-normal text-on-surface">Downloads</h2>
              <DownloadQueue progress={downloadProgress} />
            </div>

            <div className="space-y-6">
              {(isLoading || error) && (
                <h2 className="text-2xl font-normal text-on-surface">Status</h2>
              )}

              {error && (
                <div className="p-4 bg-error-container text-on-error-container rounded-2xl border-l-4 border-error flex items-start gap-3 shadow-sm">
                  <div className="flex-1 text-sm font-medium">
                    {error}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
