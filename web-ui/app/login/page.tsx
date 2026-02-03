

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
        <div className="min-h-screen bg-background text-on-background flex items-center justify-center p-4 font-roboto selection:bg-primary-container selection:text-on-primary-container">
            <div className={`max-w-md w-full bg-surface-container rounded-3xl p-8 shadow-xl space-y-8 transition-all duration-300 transform ${authData ? 'scale-105' : 'scale-100'}`}>
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-normal text-on-surface tracking-tight">Connect Tidal Account</h1>
                    <p className="text-on-surface-variant text-sm font-medium">Device Login Flow</p>
                </div>

                {!authData ? (
                    <div className="space-y-4">
                        <button
                            onClick={handleLogin}
                            disabled={isLoading}
                            className="w-full py-3.5 bg-primary text-on-primary rounded-full font-medium transition-all shadow-sm hover:shadow-md hover:bg-primary/90 disabled:opacity-50 disabled:bg-surface-container-highest disabled:text-on-surface-variant/38 flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                        >
                            {isLoading ? "Connecting..." : "Start Device Login"}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-surface-container-high p-6 rounded-2xl border border-outline-variant/50 text-center space-y-4">
                            <p className="text-sm text-on-surface-variant font-medium">Your Connection Code</p>
                            <div className="flex items-center justify-center gap-3">
                                <code className="text-4xl font-mono text-primary font-bold tracking-widest">
                                    {authData.user_code}
                                </code>
                                <button
                                    onClick={handleCopyCode}
                                    className="p-2.5 hover:bg-surface-container-highest rounded-full transition-colors text-on-surface-variant hover:text-primary"
                                    title="Copy Code"
                                >
                                    {copied ? <Check className="w-5 h-5 text-tertiary" /> : <Copy className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <a
                            href={authData.verification_uri_complete.startsWith('http') ? authData.verification_uri_complete : `https://${authData.verification_uri_complete}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-3.5 bg-primary text-on-primary rounded-full font-medium transition-all shadow-md hover:shadow-lg hover:bg-primary/90 flex items-center justify-center gap-2"
                        >
                            <ExternalLink className="w-4 h-4" />
                            Open Login Page
                        </a>

                        <p className="text-xs text-center text-on-surface-variant/70 leading-relaxed">
                            Clicking button will open Tidal login in a new tab.
                            <br />
                            Verify the code matches the one above.
                        </p>
                    </div>
                )}

                <div className="bg-surface-container-highest/50 rounded-xl p-4 font-mono text-xs text-tertiary min-h-[120px] max-h-[200px] overflow-y-auto whitespace-pre-wrap flex flex-col gap-1.5 border border-outline-variant/20 scrollbar-thin scrollbar-thumb-outline-variant/40 scrollbar-track-transparent">
                    <div className="flex items-center gap-2 border-b border-outline-variant/20 pb-2 mb-1">
                        <Terminal className="w-3.5 h-3.5 text-on-surface-variant" />
                        <span className="text-on-surface-variant font-medium">Console Output</span>
                    </div>
                    {logs.length > 0 ? logs.map((log, i) => (
                        <div key={i} className="break-all pl-1 border-l-2 border-tertiary/30">{log}</div>
                    )) : (
                        <span className="text-on-surface-variant/50 italic pl-1">Waiting for action...</span>
                    )}
                </div>

                <div className="text-center pt-2">
                    <Link href="/" className="text-sm font-medium text-on-surface-variant hover:text-primary hover:bg-surface-container-highest px-4 py-2 rounded-full transition-colors">
                        Skip to Dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
}
