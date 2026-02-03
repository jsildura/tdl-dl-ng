
import { Download, Link } from "lucide-react";
import { useState } from "react";

interface UrlInputProps {
    onDownload: (url: string) => void;
    isLoading?: boolean;
}

export function UrlInput({ onDownload, isLoading }: UrlInputProps) {
    const [url, setUrl] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (url.trim()) {
            onDownload(url);
            setUrl(""); // Clear after submit
        }
    };

    return (
        <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
            <div className="relative">
                <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="Paste Tidal URL (Track, Album, Playlist, or Video)..."
                    className="w-full px-4 py-3 pl-12 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                    disabled={isLoading}
                />
                <Link className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <button
                    type="submit"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 px-4 py-1.5 bg-cyan-600 text-white rounded-md hover:bg-cyan-700 disabled:opacity-50 transition text-sm font-medium flex items-center gap-2"
                    disabled={isLoading || !url.trim()}
                >
                    <Download className="w-4 h-4" />
                    {isLoading ? "Starting..." : "Download"}
                </button>
            </div>
        </form>
    );
}
