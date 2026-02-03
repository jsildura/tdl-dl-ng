

"use client";


import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Terminal } from "lucide-react";
import { useSSE } from "@/hooks/useSSE";

export default function LoginPage() {
    const [logs, setLogs] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const router = useRouter();
    const { data } = useSSE("http://127.0.0.1:8000/api/events");

    useEffect(() => {
        if (data) {
            if (data.type === "login_log") {
                setLogs((prev) => [...prev, data.value]);
            } else if (data.type === "login_success") {
                setLogs((prev) => [...prev, "Login Successful! Redirecting..."]);
                setIsLoading(false);
                setTimeout(() => {
                    router.push("/");
                }, 2000);
            } else if (data.type === "login_error") {
                setLogs((prev) => [...prev, "Error: " + data.value]);
                setIsLoading(false);
            }
        }
    }, [data, router]);

    const handleLogin = async () => {
        setIsLoading(true);
        setLogs([]);
        try {
            const res = await fetch("http://127.0.0.1:8000/api/login/device", { method: "POST" });
            const json = await res.json();
            if (json.status === "initiated") {
                setLogs(prev => [...prev, "Login initiated..."]);
            }
        } catch (e) {
            console.error(e);
            setLogs(["Error triggering login. Check server connection."]);
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-gray-800 rounded-lg p-8 border border-gray-700 shadow-2xl space-y-6">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-white mb-2">Connect Tidal Account</h1>
                    <p className="text-gray-400 text-sm">Use Device Login flow to authenticate</p>
                </div>

                <div className="space-y-4">
                    <button
                        onClick={handleLogin}
                        disabled={isLoading}
                        className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 rounded-md text-white font-semibold transition disabled:opacity-50"
                    >
                        {isLoading ? "Initiating..." : "Start Device Login"}
                    </button>

                    <div className="bg-black/50 rounded p-4 font-mono text-xs text-green-400 min-h-[100px] whitespace-pre-wrap flex flex-col gap-1">
                        <div className="flex items-center gap-2 border-b border-gray-800 pb-2 mb-2">
                            <Terminal className="w-3 h-3" />
                            <span className="text-gray-500">Console Output</span>
                        </div>
                        {logs.length > 0 ? logs.map((log, i) => (
                            <div key={i}>{log}</div>
                        )) : (
                            <span className="text-gray-600 italic">Waiting for logs...</span>
                        )}
                    </div>

                    <div className="text-center pt-4">
                        <Link href="/" className="text-sm text-gray-500 hover:text-cyan-400">Skip to Dashboard</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
