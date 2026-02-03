

"use client";

import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Terminal, ExternalLink, Copy, Check } from "lucide-react";

interface DeviceAuthData {
    user_code: string;
    verification_uri: string;
    verification_uri_complete: string;
    device_code: string;
    interval: number;
    expires_in: number;
}

export default function LoginPage() {
    const [logs, setLogs] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [authData, setAuthData] = useState<DeviceAuthData | null>(null);
    const [copied, setCopied] = useState(false);
    const pollingRef = useRef<NodeJS.Timeout | null>(null);
    const loginSuccessRef = useRef(false); // Flag to prevent polling after success

    const router = useRouter();

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            if (pollingRef.current) {
                clearTimeout(pollingRef.current);
            }
        };
    }, []);

    const addLog = (message: string) => {
        setLogs(prev => [...prev, `> ${message}`]);
    };

    const handleCopyCode = () => {
        if (authData?.user_code) {
            navigator.clipboard.writeText(authData.user_code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const startPolling = (deviceCode: string, intervalSeconds: number) => {
        // Clear any existing polling
        if (pollingRef.current) {
            clearTimeout(pollingRef.current);
            pollingRef.current = null;
        }
        loginSuccessRef.current = false; // Reset on new polling session

        // Use at least 2 seconds as the minimum interval to avoid rate limiting
        const safeInterval = Math.max(intervalSeconds, 2);
        addLog(`Waiting for approval... Polling every ${safeInterval}s`);

        const poll = async () => {
            // Stop if already successful or component unmounted
            if (loginSuccessRef.current) {
                return;
            }

            try {
                const result = await api.pollLogin(deviceCode);

                if (result.success) {
                    // Set flag immediately to prevent any more polling
                    loginSuccessRef.current = true;

                    addLog("Login Successful!");
                    addLog("Redirecting to dashboard...");

                    // Small delay to let user see success message
                    setTimeout(() => {
                        router.push("/");
                    }, 1500);
                    return; // Don't schedule next poll
                }
            } catch (error) {
                // Log but continue polling for transient errors
                console.error("Polling error:", error);
            }

            // Schedule next poll only after current one completes
            // This prevents overlapping requests
            if (!loginSuccessRef.current) {
                pollingRef.current = setTimeout(poll, safeInterval * 1000);
            }
        };

        // Start first poll after the interval (not immediately)
        pollingRef.current = setTimeout(poll, safeInterval * 1000);
    };

    const handleLogin = async () => {
        setIsLoading(true);
        setLogs([]);
        setAuthData(null);

        addLog("Initiating device login...");

        try {
            const data = await api.startLogin();
            setAuthData(data);
            addLog(`Device code received. User Code: ${data.user_code}`);
            addLog("Please verify in the popup window or click the link below.");

            // Poll strictly using the interval provided by the API
            startPolling(data.device_code, data.interval);

            // Automatically open the verification URL in a new tab if possible
            // window.open(data.verification_uri_complete, '_blank'); 

        } catch (e) {
            console.error(e);
            addLog("Error starting login. Check console/network.");
            if (e instanceof Error) {
                addLog(`Error: ${e.message}`);
            }
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center p-4">
            <div className={`max-w-md w-full bg-gray-800 rounded-lg p-8 border border-gray-700 shadow-2xl space-y-6 transition-all duration-300 ${authData ? 'scale-105' : ''}`}>
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-white mb-2">Connect Tidal Account</h1>
                    <p className="text-gray-400 text-sm">Device Login Flow</p>
                </div>

                {!authData ? (
                    <div className="space-y-4">
                        <button
                            onClick={handleLogin}
                            disabled={isLoading}
                            className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 rounded-md text-white font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isLoading ? "Connecting..." : "Start Device Login"}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-gray-900/50 p-4 rounded-lg border border-cyan-500/30 text-center space-y-3">
                            <p className="text-sm text-gray-400">Your Connection Code</p>
                            <div className="flex items-center justify-center gap-2">
                                <code className="text-3xl font-mono text-cyan-400 font-bold tracking-wider">
                                    {authData.user_code}
                                </code>
                                <button
                                    onClick={handleCopyCode}
                                    className="p-2 hover:bg-gray-700 rounded-full transition text-gray-400 hover:text-white"
                                    title="Copy Code"
                                >
                                    {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <a
                            href={authData.verification_uri_complete}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 rounded-md text-white font-semibold transition flex items-center justify-center gap-2 shadow-lg shadow-cyan-900/20"
                        >
                            <ExternalLink className="w-4 h-4" />
                            Open Login Page
                        </a>

                        <p className="text-xs text-center text-gray-500">
                            Clicking button will open Tidal login in a new tab.
                            <br />
                            Verify the code matches the one above.
                        </p>
                    </div>
                )}

                <div className="bg-black/50 rounded p-4 font-mono text-xs text-green-400 min-h-[100px] max-h-[200px] overflow-y-auto whitespace-pre-wrap flex flex-col gap-1 border border-gray-800">
                    <div className="flex items-center gap-2 border-b border-gray-800 pb-2 mb-2">
                        <Terminal className="w-3 h-3" />
                        <span className="text-gray-500">Console Output</span>
                    </div>
                    {logs.length > 0 ? logs.map((log, i) => (
                        <div key={i} className="break-all">{log}</div>
                    )) : (
                        <span className="text-gray-600 italic">Waiting for action...</span>
                    )}
                </div>

                <div className="text-center pt-2">
                    <Link href="/" className="text-sm text-gray-500 hover:text-cyan-400 transition">
                        Skip to Dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
}
