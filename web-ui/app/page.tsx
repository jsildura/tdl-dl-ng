
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import BannerAd from "../components/BannerAd";
import { UrlInput } from "../components/UrlInput";
import { DownloadQueue } from "../components/DownloadQueue";
import { api } from "../lib/api";
import { DownloadProgress } from "../lib/downloader";
import { TidalTrack, TidalAlbum, TidalPlaylist } from "../lib/tidal-client";
import { addDownloadHistory, subscribeToDownloadHistory, incrementDownloadCount, subscribeToDownloadCount, DownloadHistoryItem } from "../lib/download-history";
import { Menu, X, User, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";

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
  const [logs, setLogs] = useState<string[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDesktopMenuOpen, setIsDesktopMenuOpen] = useState(false);
  const [history, setHistory] = useState<DownloadHistoryItem[]>([]);
  const [totalDownloads, setTotalDownloads] = useState<number>(0);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    if (typeof document !== 'undefined' && (document as any).startViewTransition) {
      (document as any).startViewTransition(() => {
        setTheme(newTheme);
      });
    } else {
      setTheme(newTheme);
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    api.checkStatus().then(setStatus).catch(console.error);

    // Subscribe to real-time history updates from cloud
    const unsubscribe = subscribeToDownloadHistory((items) => {
      setHistory(items);
    }, 5);

    // Subscribe to total download count
    const unsubscribeStats = subscribeToDownloadCount((count) => {
      setTotalDownloads(count);
    });

    // Cleanup subscription on unmount
    return () => {
      unsubscribe();
      unsubscribeStats();
    };
  }, []);

  const addToHistory = async (item: Omit<DownloadHistoryItem, 'id' | 'timestamp'>) => {
    try {
      await addDownloadHistory(item);
      // Real-time listener will automatically update the UI
    } catch (error) {
      console.error('Failed to add to history:', error);
    }
  };



  const handleUrlDownload = async (url: string) => {
    setIsLoading(true);
    setError("");
    setDownloadProgress({ stage: 'fetching', progress: 0, message: 'Starting download...' });
    setLogs([]); // Reset logs for new download

    try {
      const result = await api.download(
        { url },
        (progress) => {
          setDownloadProgress(progress);
        },
        (logMessage) => {
          setLogs(prev => [...prev, logMessage]);
        }
      ) as { status: string; type?: string; data?: TidalTrack | TidalAlbum | TidalPlaylist; isAtmos?: boolean };

      // Add to history if successful
      if (result.status === 'completed' && result.data) {
        const now = new Date();
        const dateStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        let historyItem: DownloadHistoryItem | null = null;

        if (result.type === 'TRACK') {
          const track = result.data as TidalTrack;
          historyItem = {
            id: Date.now().toString(),
            title: track.title,
            artist: track.artist?.name || 'Unknown',
            type: 'Track',
            date: dateStr,
            isAtmos: result.isAtmos
          };
        } else if (result.type === 'ALBUM') {
          const album = result.data as TidalAlbum;
          historyItem = {
            id: Date.now().toString(),
            title: album.title,
            artist: album.artist?.name || 'Unknown',
            type: 'Album',
            date: dateStr,
            isAtmos: result.isAtmos
          };
        } else if (result.type === 'PLAYLIST') {
          const playlist = result.data as TidalPlaylist;
          historyItem = {
            id: Date.now().toString(),
            title: playlist.title,
            artist: 'Tidal Playlist',
            type: 'Playlist',
            date: dateStr,
            isAtmos: result.isAtmos
          };
        }

        if (historyItem) {
          // Fire-and-forget: don't await these to prevent blocking UI reset
          addToHistory(historyItem).catch(err => console.warn('History save failed:', err));
          incrementDownloadCount().catch(err => console.warn('Stats update failed:', err));
        }
      }

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
    // Show confirmation dialog
    if (!confirm('Are you sure you want to logout?')) {
      return;
    }

    try {
      const result = await api.logout();
      if (result.success) {
        setStatus({ logged_in: false, username: undefined, email: undefined });
        alert('You have been logged out successfully.');
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
          <div className="hidden md:flex absolute top-0 right-0 z-50 gap-2 items-center">
            {status.logged_in ? (
              <div className="relative">
                <button
                  onClick={() => setIsDesktopMenuOpen(!isDesktopMenuOpen)}
                  className="p-2.5 bg-surface-container-high hover:bg-surface-container-highest rounded-full transition-all duration-200 cursor-pointer"
                >
                  <User size={18} className="icon-contrast" />
                </button>

                {isDesktopMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-surface-container rounded-2xl shadow-xl border border-outline-variant/20 flex flex-col overflow-hidden">
                    <div className="px-5 py-4">
                      <p className="text-xs text-on-surface-variant">Signed in as</p>
                      <p className="text-sm font-medium text-primary truncate mt-0.5">
                        {status.email || status.username}
                      </p>
                    </div>
                    <div className="border-t border-outline-variant/20" />
                    {mounted && (
                      <button
                        onClick={toggleTheme}
                        className="block w-full text-left px-5 py-3 text-sm text-on-surface hover:bg-surface-container-highest transition-colors cursor-pointer"
                      >
                        {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                      </button>
                    )}
                    <a
                      href="/settings"
                      className="block w-full text-left px-5 py-3 text-sm text-on-surface hover:bg-surface-container-highest transition-colors"
                    >
                      Settings
                    </a>
                    <div className="border-t border-outline-variant/20" />
                    <button
                      onClick={() => {
                        handleLogout();
                        setIsDesktopMenuOpen(false);
                      }}
                      className="block w-full text-left px-5 py-3 text-sm text-error hover:bg-error-container/20 transition-colors cursor-pointer"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <a href="/login" className="text-sm font-medium text-on-surface hover:bg-primary-container/20 px-4 py-2 rounded-full transition-colors duration-200">
                Login
              </a>
            )}
          </div>

          {/* Mobile Menu */}
          <div className="md:hidden absolute top-0 right-0 z-50">
            {status.logged_in ? (
              <>
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="p-2 text-on-surface hover:bg-surface-container-highest rounded-full transition-colors"
                >
                  {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>

                {isMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-surface-container rounded-2xl shadow-xl border border-outline-variant/20 p-2 flex flex-col gap-1 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="px-4 py-3 border-b border-outline-variant/20 mb-1">
                      <p className="text-xs text-on-surface-variant">Signed in as</p>
                      <p className="text-sm font-medium text-primary truncate">
                        {status.email || status.username}
                      </p>
                    </div>
                    {mounted && (
                      <button
                        onClick={toggleTheme}
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-on-surface hover:bg-surface-container-highest rounded-xl transition-colors text-left"
                      >
                        {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                      </button>
                    )}
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
                  </div>
                )}
              </>
            ) : (
              <a href="/login" className="text-sm font-medium text-on-surface hover:bg-primary-container/20 px-4 py-2 rounded-full transition-colors duration-200">
                Login
              </a>
            )}
          </div>

          <div className="space-y-4 pt-8">
            <h1 className="text-2xl md:text-6xl font-bold tracking-tight text-on-surface pb-2">
              Tidal Downloader Web
            </h1>
            <p className="text-sm md:text-xl text-on-surface-variant max-w-lg mx-auto leading-relaxed">
              Next Generation Downloader for Tidal
            </p>
            {api.isServerless() && (
              <span className="inline-flex items-center px-3 py-1 text-xs font-medium bg-[#303030] dark:bg-secondary-container text-white dark:text-on-secondary-container rounded-lg shadow-sm">
                Serverless
              </span>
            )}
          </div>
        </header>

        <div className="space-y-12">
          <BannerAd />
          <UrlInput onDownload={handleUrlDownload} isLoading={isLoading} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            <div className="space-y-2">
              <h2 className="text-base md:text-2xl font-normal text-on-surface">Downloads</h2>
              <DownloadQueue progress={downloadProgress} logs={logs} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-base md:text-2xl font-normal text-on-surface">
                  Recent Download
                </h2>

              </div>

              {/* Status/Error messages still shown if present */}
              {error && (
                <div className="p-4 bg-error-container text-on-error-container rounded-2xl border-l-4 border-error flex items-start gap-3 shadow-sm animate-in slide-in-from-top-2">
                  <div className="flex-1 text-sm font-medium">
                    {error}
                  </div>
                </div>
              )}

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                {history.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-outline-variant/30 rounded-2xl">
                    <p className="text-on-surface-variant/60 text-sm italic">No downloads yet.</p>
                  </div>
                ) : (
                  history.map(item => (
                    <div key={item.id} className="p-3 bg-surface-container-high/40 hover:bg-surface-container-high rounded-xl border border-outline-variant/20 hover:border-primary/20 transition-all group">
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <p className="font-medium text-on-surface truncate text-sm">
                              {item.artist}
                            </p>
                            <span className="text-on-surface-variant/60 text-xs">-</span>
                            <p className="text-on-surface-variant truncate text-sm">
                              {item.title}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold ${item.type === 'Track' ? 'bg-primary/10 text-primary' :
                              item.type === 'Album' ? 'bg-secondary/10 text-secondary' :
                                'bg-tertiary/10 text-tertiary'
                              }`}>
                              {item.type}
                            </span>
                            {item.isAtmos && (
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
                            <span className="text-[10px] text-outline">
                              {item.date}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center pt-12 space-y-6">
          <div className="flex justify-center items-center gap-2 text-sm font-medium text-primary">
            <Link href="/faq" className="hover:underline">
              Faq
            </Link>
            <span>|</span>
            <Link href="/privacy" className="hover:underline">
              Privacy
            </Link>
            {totalDownloads > 0 && (
              <>
                <span>|</span>
                <span>Current number of downloads: {totalDownloads}</span>
              </>
            )}
          </div>

          <p className="text-[10px] md:text-xs text-on-surface-variant/40 max-w-3xl mx-auto leading-relaxed px-4">
            Tidal Downloader Web is intended strictly for private use and requires an active Tidal-HiFi subscription; users are prohibited from engaging in music piracy or distribution and are responsible for ensuring compliance with all applicable local laws.
          </p>
        </footer>
      </div>
    </main>
  );
}