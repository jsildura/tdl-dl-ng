
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
            <div className="relative group">
                <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="Paste Tidal URL (https://tidal.com/track/119626470)..."
                    className="w-full pl-12 pr-40 py-4 text-sm rounded-full bg-surface-container-high text-on-surface placeholder:text-on-surface-variant/70 border-none outline-none ring-1 ring-transparent focus:ring-2 focus:ring-primary transition-all duration-200 shadow-sm"
                    disabled={isLoading}
                />
                <Link className="absolute left-4 top-1/2 transform -translate-y-1/2 text-on-surface-variant w-6 h-6" />
                <button
                    type="submit"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 px-6 py-2.5 bg-primary text-on-primary rounded-full hover:bg-primary/90 disabled:opacity-50 disabled:bg-surface-container-highest disabled:text-on-surface-variant/38 transition-all shadow-sm hover:shadow-md text-sm font-medium flex items-center gap-2 active:scale-95"
                    disabled={isLoading || !url.trim()}
                >
                    <Download className="w-4 h-4" />
                    {isLoading ? "Starting..." : "Download"}
                </button>
            </div>
        </form>
    );
}
